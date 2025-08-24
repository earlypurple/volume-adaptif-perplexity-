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
    this.isMacBookAirM4 = this.detectMacBookAirM4();
    this.spatialWorklet = null;
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
    
    // Initialiser la détection automatique des participants
    this.initializeParticipantDetection();
  }
  
  detectMacBookAirM4() {
    // Détection du MacBook Air M4
    const userAgent = navigator.userAgent.toLowerCase();
    const isMac = userAgent.includes('mac');
    const hasAdvancedAudio = 'AudioWorklet' in window && 'createPanner' in (AudioContext.prototype || webkitAudioContext.prototype);
    const hasM4Features = navigator.hardwareConcurrency >= 8;
    
    return isMac && hasAdvancedAudio && hasM4Features;
  }
  
  initializeParticipantDetection() {
    // Observer pour détecter automatiquement les nouveaux participants vidéo
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Détecter les éléments vidéo des participants
            const videoElements = node.querySelectorAll ? 
              node.querySelectorAll('video, audio') : 
              (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') ? [node] : [];
            
            videoElements.forEach((element, index) => {
              this.assignSpatialPosition(element, index);
            });
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Traiter les éléments existants
    setTimeout(() => {
      const existingElements = document.querySelectorAll('video, audio');
      existingElements.forEach((element, index) => {
        this.assignSpatialPosition(element, index);
      });
    }, 2000);
  }
  
  assignSpatialPosition(element, index) {
    // Assigner une position spatiale à chaque participant
    const positions = [
      { x: 0, y: 0, z: -1 },     // Centre (utilisateur principal)
      { x: -2, y: 0, z: -1 },   // Gauche
      { x: 2, y: 0, z: -1 },    // Droite
      { x: -1, y: 1, z: -1 },   // Gauche-haut
      { x: 1, y: 1, z: -1 },    // Droite-haut
      { x: -3, y: 0, z: -2 },   // Loin gauche
      { x: 3, y: 0, z: -2 },    // Loin droite
    ];
    
    const position = positions[index % positions.length];
    this.participantPositions.set(element, position);
    
    // Appliquer la position si l'élément est déjà amélioré
    if (this.spatialNodes.has(element)) {
      const pannerNode = this.spatialNodes.get(element);
      pannerNode.setPosition(position.x, position.y, position.z);
    }
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
      
      // Initialiser l'AudioWorklet spatial pour MacBook Air M4
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
      // Créer la chaîne de traitement audio de base
      const source = this.audioContext.createMediaElementSource(element);
      const gainNode = this.audioContext.createGain();
      
      let currentNode = gainNode;
      
      // Ajouter le traitement spatial pour MacBook Air M4
      if (this.isMacBookAirM4) {
        // Créer un nœud de panoramique 3D
        const pannerNode = this.audioContext.createPanner();
        pannerNode.panningModel = 'HRTF';
        pannerNode.distanceModel = 'exponential';
        pannerNode.maxDistance = 10;
        pannerNode.rolloffFactor = 1;
        pannerNode.coneInnerAngle = 360;
        pannerNode.coneOuterAngle = 0;
        pannerNode.coneOuterGain = 0;
        
        // Appliquer la position spatiale si elle existe
        const position = this.participantPositions.get(element) || { x: 0, y: 0, z: -1 };
        pannerNode.setPosition(position.x, position.y, position.z);
        pannerNode.setOrientation(0, 0, -1);
        
        // Créer un processeur spatial avec AudioWorklet
        let spatialProcessor = null;
        try {
          spatialProcessor = new AudioWorkletNode(this.audioContext, 'spatial-audio-processor');
          spatialProcessor.port.postMessage({
            type: 'UPDATE_M4_CONFIG',
            data: {
              useNeuralEngine: true,
              enhancedDSP: true,
              spatialProcessing: true,
              binauralEnhancement: true
            }
          });
        } catch (error) {
          console.warn('Impossible de créer l\'AudioWorkletNode spatial:', error);
        }
        
        // Connecter: source -> gain -> spatial processor -> panner -> destination
        source.connect(gainNode);
        
        if (spatialProcessor) {
          gainNode.connect(spatialProcessor);
          spatialProcessor.connect(pannerNode);
        } else {
          gainNode.connect(pannerNode);
        }
        
        pannerNode.connect(this.audioContext.destination);
        
        // Stocker les références
        this.spatialNodes.set(element, pannerNode);
        if (spatialProcessor) {
          element.spatialProcessor = spatialProcessor;
        }
        
        currentNode = pannerNode;
      } else {
        // Traitement audio standard
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
      }
      
      // Stocker la référence du gain node
      this.gainNodes.set(element, gainNode);
      
      console.log('Élément multimédia amélioré avec audio spatial:', element);
      
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
        
      case 'UPDATE_SPATIAL_POSITIONS':
        this.updateSpatialPositions(message.positions);
        break;
        
      case 'TOGGLE_SPATIAL_AUDIO':
        this.toggleSpatialAudio(message.enabled);
        break;
        
      case 'UPDATE_SPATIAL_PARAMS':
        this.updateSpatialParams(message.params);
        break;
        
      case 'TEST_SPATIAL_AUDIO':
        this.testSpatialAudio();
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
  
  updateSpatialParams(params) {
    // Mettre à jour les paramètres du processeur spatial
    this.spatialNodes.forEach((pannerNode, element) => {
      if (element.spatialProcessor) {
        element.spatialProcessor.port.postMessage({
          type: 'UPDATE_SPATIAL_PARAMS',
          data: params
        });
      }
    });
  }
  
  testSpatialAudio() {
    if (!this.isMacBookAirM4) return;
    
    // Test de l'audio spatial en déplaçant temporairement les sources
    const testPositions = [
      { x: -2, y: 0, z: -1 },
      { x: 2, y: 0, z: -1 },
      { x: 0, y: 1, z: -2 },
      { x: 0, y: 0, z: -1 }
    ];
    
    let positionIndex = 0;
    const testInterval = setInterval(() => {
      this.spatialNodes.forEach((pannerNode) => {
        const pos = testPositions[positionIndex % testPositions.length];
        pannerNode.setPosition(pos.x, pos.y, pos.z);
      });
      
      positionIndex++;
      if (positionIndex >= testPositions.length * 2) {
        clearInterval(testInterval);
        // Restaurer les positions originales
        this.spatialNodes.forEach((pannerNode, element) => {
          const originalPos = this.participantPositions.get(element) || { x: 0, y: 0, z: -1 };
          pannerNode.setPosition(originalPos.x, originalPos.y, originalPos.z);
        });
      }
    }, 500);
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
