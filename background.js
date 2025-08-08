import { AdaptiveVolumeAlgorithm } from './app.js';

// Service Worker principal
class VolumeAdaptiveManager {
  constructor() {
    this.isActive = false;
    this.activeTabId = null;
    this.settings = {
      sensitivity: 'medium',
      voicePriority: false,
      referenceLevel: 35,
      profiles: {}
    };
    this.algorithm = new AdaptiveVolumeAlgorithm(this.settings);
    this.init();
  }

  async init() {
    // Charger les paramètres sauvegardés
    const stored = await chrome.storage.sync.get(['volumeSettings']);
    if (stored.volumeSettings) {
      this.settings = { ...this.settings, ...stored.volumeSettings };
      this.algorithm.referenceLevel = this.settings.referenceLevel;
      this.algorithm.setSensitivity(this.settings.sensitivity);
    }
    
    // Écouter les messages
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Écouter les changements d'onglets
    chrome.tabs.onActivated.addListener(this.handleTabChange.bind(this));
  }

  handleTabChange({ tabId }) {
      this.activeTabId = tabId;
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'TOGGLE_ACTIVATION':
        await this.toggleActivation(message.active, sender.tab.id);
        sendResponse({ success: true, isActive: this.isActive });
        break;
        
      case 'NOISE_LEVEL_UPDATE':
        if (this.isActive) {
            this.processNoiseLevel(message.data, sender.tab.id);
        }
        break;
        
      case 'GET_SETTINGS':
        sendResponse(this.settings);
        break;
        
      case 'UPDATE_SETTINGS':
        await this.updateSettings(message.settings);
        sendResponse({ success: true });
        break;

      case 'START_CALIBRATION':
        if(this.activeTabId) {
            chrome.tabs.sendMessage(this.activeTabId, { type: 'START_CALIBRATION' });
        }
        break;

      case 'CALIBRATION_COMPLETE':
        this.settings.referenceLevel = message.referenceLevel;
        this.algorithm.referenceLevel = message.referenceLevel;
        await this.updateSettings({ referenceLevel: message.referenceLevel });
        break;
    }
    return true; // Indiquer une réponse asynchrone
  }

  async toggleActivation(shouldBeActive, tabId) {
    this.isActive = shouldBeActive;
    this.activeTabId = this.isActive ? tabId : null;

    if (this.isActive) {
        // Injecter le script de traitement audio
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['inject.js']
        });
    }
    
    // Sauvegarder l'état
    await chrome.storage.sync.set({ 
      volumeActive: this.isActive,
      activeTabId: this.activeTabId
    });
  }

  processNoiseLevel(data, tabId) {
    const { noiseLevel, timestamp } = data;
    
    // Calculer les nouveaux gains via l'algorithme centralisé
    const gains = this.algorithm.calculateGains(noiseLevel, timestamp);
    
    const finalGains = {
        speakerGain: gains.speaker,
        micGain: gains.mic,
        timestamp: gains.timestamp
    };

    // 1. Envoyer les ajustements de HAUT-PARLEUR au content script
    chrome.tabs.sendMessage(tabId, {
      type: 'APPLY_SPEAKER_GAIN',
      gain: finalGains.speakerGain
    });

    // 2. Injecter directement l'ajustement du MICROPHONE
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (gain) => {
            if (window.volumeAdaptiveControls && window.volumeAdaptiveControls.setMicGain) {
                window.volumeAdaptiveControls.setMicGain(gain);
            }
        },
        args: [finalGains.micGain],
        world: 'MAIN'
    });

    // 3. Envoyer la mise à jour à la popup
    chrome.runtime.sendMessage({
        type: 'VOLUME_UPDATE',
        data: {
            noiseLevel: noiseLevel,
            speakerGain: finalGains.speakerGain,
            micGain: finalGains.micGain
        }
    });
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.sensitivity) {
        this.algorithm.setSensitivity(newSettings.sensitivity);
    }
    await chrome.storage.sync.set({ volumeSettings: this.settings });
  }

  // Méthode pour obtenir le niveau de référence, maintenant gérée par l'algo
  getReferenceLevel() {
      return this.algorithm.referenceLevel;
  }
}

// Initialiser le gestionnaire
const volumeManager = new VolumeAdaptiveManager();
