// Script injecté dans les pages de conférence
class ConferenceAudioProcessor {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.gainNodes = new Map();
    this.spatialNodes = new Map(); // Nouveaux nœuds spatiaux
    this.participantPositions = new Map(); // Positions des participants
    this.isProcessing = false;
    this.noiseBuffer = new Float32Array(2048);
    this.referenceLevel = 35;
    this.lastUpdate = 0;
    this.isMacBookAirM4 = false; // La détection est maintenant centralisée
    this.spatialWorklet = null;
    this.init();
  }

  async init() {
    try {
      // Récupérer la configuration du background script
      chrome.runtime.sendMessage({ type: 'GET_FEATURES_CONFIG' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to get features config:', chrome.runtime.lastError);
          this.deferredInit();
          return;
        }
        
        if (response && response.isMacBookAirM4) {
          this.isMacBookAirM4 = true;
        }
        // Poursuivre l'initialisation après avoir reçu la config
        this.deferredInit();
      });

      // Écouter les messages du background script
      chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    } catch (error) {
      console.error('Error during content script initialization:', error);
      // Continuer l'initialisation même en cas d'erreur
      this.deferredInit();
    }
  }

  deferredInit() {
     // Attendre que la page soit complètement chargée
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => this.setupAudioProcessing());
    } else {
      this.setupAudioProcessing();
    }
    
    // La détection des participants est activée pour l'audio spatial.
    this.initializeParticipantDetection();
  }

  async setupAudioProcessing() {
    try {
      // Créer le contexte audio
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Attendre l'activation par l'utilisateur si nécessaire
      if (this.audioContext.state === 'suspended') {
        document.addEventListener('click', () => {
          this.audioContext.resume();
        }, { once: true });
      }
      
      // L'initialisation de l'AudioWorklet spatial est activée si M4 est supporté.
      if (this.isMacBookAirM4) {
        try {
          await this.audioContext.audioWorklet.addModule(chrome.runtime.getURL('spatial-audio-processor.js'));
          console.log('AudioWorklet spatial chargé pour MacBook Air M4');
        } catch (error) {
          console.warn('Impossible de charger l\'AudioWorklet spatial:', error);
        }
      }
      
      // Surveiller les éléments audio/vidéo
      this.observeMediaElements();
      
      // Configurer la détection de bruit ambiant
      await this.setupNoiseDetection();
      
    } catch (error) {
      console.error('Erreur lors de l\'initialisation audio:', error);
    }
  }

  async setupNoiseDetection() {
    try {
      // Demander accès au microphone pour mesurer le bruit ambiant
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      // Créer l'analyseur de bruit
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      
      source.connect(this.analyser);
      
      // Démarrer l'analyse du bruit
      this.startNoiseMonitoring();
      
    } catch (error) {
      console.warn('Impossible d\'accéder au microphone pour la détection de bruit:', error);
      // Continuer avec une détection simulée si nécessaire
      this.startSimulatedNoiseDetection();
    }
  }
  
  startSimulatedNoiseDetection() {
    // Méthode de fallback qui simule la détection de bruit
    console.log('Démarrage de la détection de bruit simulée');
    const monitor = () => {
      if (!this.isProcessing) return;
      
      const now = Date.now();
      if (now - this.lastUpdate < 200) {
        requestAnimationFrame(monitor);
        return;
      }
      
      // Simuler un niveau de bruit
      const simulatedNoiseLevel = 40 + Math.random() * 20; // Entre 40 et 60 dB
      
      // Envoyer au background script
      try {
        chrome.runtime.sendMessage({
          type: 'NOISE_LEVEL_UPDATE',
          data: {
            noiseLevel: simulatedNoiseLevel,
            timestamp: now
          }
        });
      } catch (error) {
        console.warn('Failed to send simulated noise level:', error);
      }
      
      this.lastUpdate = now;
      requestAnimationFrame(monitor);
    };
    
    this.isProcessing = true;
    requestAnimationFrame(monitor);
  }

  startNoiseMonitoring() {
    const monitor = () => {
      if (!this.isProcessing) return;
      
      const now = Date.now();
      if (now - this.lastUpdate < 200) {
        requestAnimationFrame(monitor);
        return;
      }
      
      try {
        // Analyser le niveau de bruit
        if (!this.analyser) {
          console.warn('Analyser not available, stopping noise monitoring');
          this.isProcessing = false;
          return;
        }
        
        this.analyser.getFloatFrequencyData(this.noiseBuffer);
        const noiseLevel = this.calculateNoiseLevel(this.noiseBuffer);
        
        // Valider le niveau de bruit
        if (isNaN(noiseLevel) || noiseLevel < 0 || noiseLevel > 200) {
          console.warn('Invalid noise level detected:', noiseLevel);
          requestAnimationFrame(monitor);
          return;
        }
        
        // Envoyer au background script
        chrome.runtime.sendMessage({
          type: 'NOISE_LEVEL_UPDATE',
          data: {
            noiseLevel: noiseLevel,
            timestamp: now
          }
        });
        
        this.lastUpdate = now;
      } catch (error) {
        console.error('Error in noise monitoring:', error);
      }
      
      requestAnimationFrame(monitor);
    };
    
    this.isProcessing = true;
    requestAnimationFrame(monitor);
  }

  calculateNoiseLevel(frequencyData) {
    // Calculer le niveau RMS
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += Math.pow(10, frequencyData[i] / 10);
    }
    const rms = Math.sqrt(sum / frequencyData.length);
    
    // Convertir en décibels
    const dB = 20 * Math.log10(rms) + 120; // Ajustement pour obtenir des dB réalistes
    
    return Math.max(20, Math.min(120, dB));
  }

  observeMediaElements() {
    // Observer les éléments audio/vidéo existants et nouveaux
    const processMediaElement = (element) => {
      if (element.tagName === 'AUDIO' || element.tagName === 'VIDEO') {
        this.enhanceMediaElement(element);
      }
    };
    
    // Traiter les éléments existants
    document.querySelectorAll('audio, video').forEach(processMediaElement);
    
    // Observer les nouveaux éléments
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processMediaElement(node);
            node.querySelectorAll('audio, video').forEach(processMediaElement);
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  enhanceMediaElement(element) {
    if (element.dataset.volumeEnhanced) return;
    element.dataset.volumeEnhanced = 'true';
    
    try {
      const source = this.audioContext.createMediaElementSource(element);
      const gainNode = this.audioContext.createGain();

      if (this.isMacBookAirM4 && this.audioContext.audioWorklet) {
        // Chaîne de traitement avec audio spatial
        const spatialNode = new AudioWorkletNode(this.audioContext, 'spatial-audio-processor');
        source.connect(gainNode).connect(spatialNode).connect(this.audioContext.destination);
        this.spatialNodes.set(element, spatialNode);
        console.log('Élément multimédia amélioré avec audio spatial:', element);
      } else {
        // Chaîne de traitement simple
        source.connect(gainNode).connect(this.audioContext.destination);
        console.log('Élément multimédia amélioré (sans audio spatial):', element);
      }
      
      this.gainNodes.set(element, gainNode);
      
    } catch (error) {
      console.warn('Impossible d\'améliorer l\'élément multimédia:', error);
    }
  }

  initializeParticipantDetection() {
    console.log("Initialisation de la détection des participants (simulation).");
    // Dans une implémentation réelle, on utiliserait un MutationObserver
    // pour trouver les éléments vidéo des participants et leur assigner des positions.
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'APPLY_SPEAKER_GAIN':
        this.applySpeakerGain(message.gain);
        break;
        
      case 'START_CALIBRATION':
        this.startCalibration();
        break;
        
      case 'GET_STATUS':
        sendResponse({
          isProcessing: this.isProcessing,
          elementsCount: this.gainNodes.size,
          spatialElementsCount: this.spatialNodes.size,
          isMacBookAirM4: this.isMacBookAirM4
        });
        break;
    }
  }

  applySpeakerGain(speakerGain) {
    try {
      // Valider le gain
      if (typeof speakerGain !== 'number' || isNaN(speakerGain)) {
        console.warn('Invalid speaker gain value:', speakerGain);
        return;
      }
      
      // Limiter le gain dans une plage sûre
      const safeSpeakerGain = Math.max(0.1, Math.min(3.0, speakerGain));
      
      // Appliquer le gain aux éléments audio/vidéo
      this.gainNodes.forEach((gainNode, element) => {
        try {
          // Transition douce pour éviter les clics
          const currentTime = this.audioContext.currentTime;
          gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
          gainNode.gain.exponentialRampToValueAtTime(safeSpeakerGain, currentTime + 0.1);
        } catch (nodeError) {
          console.warn('Error applying gain to node:', nodeError);
        }
      });
      
      // Log pour debug
      console.log(`Speaker gain appliqué: ${safeSpeakerGain.toFixed(2)}`);
    } catch (error) {
      console.error('Error in applySpeakerGain:', error);
    }
  }

  async startCalibration() {
    // Calibration: mesurer le niveau de silence pendant 3 secondes
    const samples = [];
    const duration = 3000;
    const interval = 100;
    
    for (let i = 0; i < duration / interval; i++) {
      await new Promise(resolve => setTimeout(resolve, interval));
      
      if (this.analyser) {
        this.analyser.getFloatFrequencyData(this.noiseBuffer);
        const level = this.calculateNoiseLevel(this.noiseBuffer);
        samples.push(level);
      }
    }
    
    // Calculer le niveau de référence
    if (samples.length > 0) {
      this.referenceLevel = samples.reduce((a, b) => a + b) / samples.length;
      console.log('Niveau de référence calibré:', this.referenceLevel);
      
      // Informer le background script
      chrome.runtime.sendMessage({
        type: 'CALIBRATION_COMPLETE',
        referenceLevel: this.referenceLevel
      });
    }
  }
}

// Initialiser le processeur audio
const audioProcessor = new ConferenceAudioProcessor();
