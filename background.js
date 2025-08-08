
### 2. **Background Script (background.js)**

```javascript
// Service Worker principal
class VolumeAdaptiveManager {
  constructor() {
    this.isActive = false;
    this.settings = {
      sensitivity: 'medium',
      voicePriority: false,
      profiles: new Map()
    };
    this.init();
  }

  async init() {
    // Charger les paramètres sauvegardés
    const stored = await chrome.storage.sync.get(['volumeSettings']);
    if (stored.volumeSettings) {
      this.settings = { ...this.settings, ...stored.volumeSettings };
    }
    
    // Écouter les messages des content scripts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Écouter les changements d'onglets
    chrome.tabs.onActivated.addListener(this.handleTabChange.bind(this));
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'ACTIVATE_VOLUME_CONTROL':
        await this.activateVolumeControl(sender.tab.id);
        sendResponse({ success: true });
        break;
        
      case 'NOISE_LEVEL_UPDATE':
        this.processNoiseLevel(message.data, sender.tab.id);
        break;
        
      case 'GET_SETTINGS':
        sendResponse(this.settings);
        break;
        
      case 'UPDATE_SETTINGS':
        await this.updateSettings(message.settings);
        sendResponse({ success: true });
        break;
    }
  }

  async activateVolumeControl(tabId) {
    this.isActive = true;
    
    // Injecter le script de traitement audio
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['inject.js']
    });
    
    // Sauvegarder l'état
    await chrome.storage.sync.set({ 
      volumeActive: true,
      activeTabId: tabId 
    });
  }

  processNoiseLevel(data, tabId) {
    const { noiseLevel, timestamp } = data;
    
    // Calculer les nouveaux gains selon l'algorithme adaptatif
    const gains = this.calculateAdaptiveGains(noiseLevel);
    
    // Envoyer les ajustements au content script
    chrome.tabs.sendMessage(tabId, {
      type: 'APPLY_GAINS',
      gains: gains
    });
  }

  calculateAdaptiveGains(currentLevel) {
    const params = this.getAlgorithmParams();
    const deltaB = currentLevel - this.getReferenceLevel();
    
    let gain;
    if (deltaB > 0) {
      gain = 1 + params.k_positive * deltaB;
    } else {
      gain = 1 + params.k_negative * deltaB;
    }
    
    // Limiter le gain entre 0.1 et 3.0
    gain = Math.max(0.1, Math.min(3.0, gain));
    
    return {
      speakerGain: gain,
      micGain: Math.min(gain * 0.8, 2.0), // Gain micro légèrement plus conservateur
      timestamp: Date.now()
    };
  }

  getAlgorithmParams() {
    const sensitivity = this.settings.sensitivity;
    const params = {
      low: { k_positive: 0.02, k_negative: 0.01 },
      medium: { k_positive: 0.04, k_negative: 0.02 },
      high: { k_positive: 0.06, k_negative: 0.03 }
    };
    return params[sensitivity] || params.medium;
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    await chrome.storage.sync.set({ volumeSettings: this.settings });
  }
}

// Initialiser le gestionnaire
const volumeManager = new VolumeAdaptiveManager();
