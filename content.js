// Script injecté dans les pages de conférence
class ConferenceAudioProcessor {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.gainNodes = new Map();
    this.isProcessing = false;
    this.noiseBuffer = new Float32Array(2048);
    this.referenceLevel = 35;
    this.lastUpdate = 0;
    this.init();
  }

  async init() {
    // Attendre que la page soit complètement chargée
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => this.setupAudioProcessing());
    } else {
      this.setupAudioProcessing();
    }
    
    // Écouter les messages du background script
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
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
      console.warn('Impossible d\'accéder au microphone:', error);
    }
  }

  startNoiseMonitoring() {
    const monitor = () => {
      if (!this.isProcessing) return;
      
      const now = Date.now();
      if (now - this.lastUpdate < 200) {
        requestAnimationFrame(monitor);
        return;
      }
      
      // Analyser le niveau de bruit
      this.analyser.getFloatFrequencyData(this.noiseBuffer);
      const noiseLevel = this.calculateNoiseLevel(this.noiseBuffer);
      
      // Envoyer au background script
      chrome.runtime.sendMessage({
        type: 'NOISE_LEVEL_UPDATE',
        data: {
          noiseLevel: noiseLevel,
          timestamp: now
        }
      });
      
      this.lastUpdate = now;
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
      // Créer la chaîne de traitement audio
      const source = this.audioContext.createMediaElementSource(element);
      const gainNode = this.audioContext.createGain();
      
      // Connecter: source -> gain -> destination
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Stocker la référence du gain node
      this.gainNodes.set(element, gainNode);
      
      console.log('Élément multimédia amélioré:', element);
      
    } catch (error) {
      console.warn('Impossible d\'améliorer l\'élément multimédia:', error);
    }
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
          elementsCount: this.gainNodes.size
        });
        break;
    }
  }

  applySpeakerGain(speakerGain) {
    // Appliquer le gain aux éléments audio/vidéo
    this.gainNodes.forEach((gainNode, element) => {
      // Transition douce pour éviter les clics
      const currentTime = this.audioContext.currentTime;
      gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
      gainNode.gain.exponentialRampToValueAtTime(speakerGain, currentTime + 0.1);
    });
    
    // Log pour debug
    console.log(`Speaker gain appliqué: ${speakerGain.toFixed(2)}`);
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
