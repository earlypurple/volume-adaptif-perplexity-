// Script injecté directement dans le contexte de la page
(function() {
  'use strict';
  
  // Améliorer la Web Audio API pour les conférences vidéo avec audio spatial
  class AudioEnhancer {
    constructor() {
      this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      this.enhancedStreams = new Map();
      this.spatialContexts = new Map();
      this.participantPositions = new Map();
      this.isMacBookAirM4 = this.detectMacBookAirM4();
      this.init();
    }
    
    init() {
      // Intercepter les appels getUserMedia
      navigator.mediaDevices.getUserMedia = this.enhancedGetUserMedia.bind(this);
      
      // Intercepter les créations d'éléments audio
      this.interceptAudioCreation();
      
      // Initialiser le traitement spatial si supporté
      this.initializeSpatialAudio();
    }
    
    detectMacBookAirM4() {
      // Détection du MacBook Air M4 basée sur les capacités du navigateur
      const userAgent = navigator.userAgent.toLowerCase();
      const isMac = userAgent.includes('mac');
      const hasAdvancedAudio = 'AudioWorklet' in window && 'createPanner' in (AudioContext.prototype || webkitAudioContext.prototype);
      const hasM4Features = navigator.hardwareConcurrency >= 8; // M4 a au moins 8 coeurs
      
      return isMac && hasAdvancedAudio && hasM4Features;
    }
    
    async initializeSpatialAudio() {
      if (!this.isMacBookAirM4) return;
      
      try {
        // Charger le processeur AudioWorklet pour l'audio spatial
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.audioWorklet.addModule(chrome.runtime.getURL('spatial-audio-processor.js'));
        console.log('Audio spatial initialisé pour MacBook Air M4');
      } catch (error) {
        console.warn('Impossible de charger l\'AudioWorklet spatial:', error);
      }
    }
    
    async enhancedGetUserMedia(constraints) {
      try {
        const stream = await this.originalGetUserMedia(constraints);
        
        if (constraints.audio) {
          return this.enhanceAudioStream(stream, constraints);
        }
        
        return stream;
      } catch (error) {
        throw error;
      }
    }
    
    enhanceAudioStream(stream, constraints) {
      // Créer un contexte audio pour traiter le flux
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Créer la chaîne de traitement de base
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      const compressor = audioContext.createDynamicsCompressor();
      
      // Enhancements spéciaux pour MacBook Air M4
      let spatialProcessor = null;
      let pannerNode = null;
      let echoSuppressor = null;
      
      if (this.isMacBookAirM4) {
        // Créer le processeur spatial avec AudioWorklet
        try {
          spatialProcessor = new AudioWorkletNode(audioContext, 'spatial-audio-processor');
          
          // Créer un nœud de panoramique 3D pour l'audio spatial
          pannerNode = audioContext.createPanner();
          pannerNode.panningModel = 'HRTF';
          pannerNode.distanceModel = 'exponential';
          pannerNode.maxDistance = 10;
          pannerNode.rolloffFactor = 1;
          pannerNode.coneInnerAngle = 360;
          pannerNode.coneOuterAngle = 0;
          pannerNode.coneOuterGain = 0;
          
          // Position par défaut (devant l'utilisateur)
          pannerNode.setPosition(0, 0, -1);
          pannerNode.setOrientation(0, 0, -1);
          
          // Suppresseur d'écho avancé pour MacBook Air
          echoSuppressor = this.createAdvancedEchoSuppressor(audioContext);
          
        } catch (error) {
          console.warn('Impossible de créer le processeur spatial:', error);
        }
      }
      
      const destination = audioContext.createMediaStreamDestination();
      
      // Configurer le compresseur pour la voix (optimisé pour M4)
      compressor.threshold.setValueAtTime(-20, audioContext.currentTime);
      compressor.knee.setValueAtTime(25, audioContext.currentTime);
      compressor.ratio.setValueAtTime(8, audioContext.currentTime);
      compressor.attack.setValueAtTime(0.002, audioContext.currentTime);
      compressor.release.setValueAtTime(0.2, audioContext.currentTime);
      
      // Connecter la chaîne de traitement
      let currentNode = source;
      
      // Ajouter le suppresseur d'écho si disponible
      if (echoSuppressor) {
        currentNode.connect(echoSuppressor);
        currentNode = echoSuppressor;
      }
      
      currentNode.connect(gainNode);
      currentNode = gainNode;
      
      // Ajouter le processeur spatial si disponible
      if (spatialProcessor) {
        currentNode.connect(spatialProcessor);
        currentNode = spatialProcessor;
      }
      
      currentNode.connect(compressor);
      currentNode = compressor;
      
      // Ajouter le nœud de panoramique si disponible
      if (pannerNode) {
        currentNode.connect(pannerNode);
        currentNode = pannerNode;
      }
      
      currentNode.connect(destination);
      
      // Stocker les références pour contrôle externe
      const enhancedInfo = {
        originalStream: stream,
        audioContext: audioContext,
        gainNode: gainNode,
        compressor: compressor,
        spatialProcessor: spatialProcessor,
        pannerNode: pannerNode,
        echoSuppressor: echoSuppressor
      };
      
      this.enhancedStreams.set(destination.stream, enhancedInfo);
      
      // Exposer les contrôles via l'objet window pour l'extension
      window.volumeAdaptiveControls = window.volumeAdaptiveControls || {};
      window.volumeAdaptiveControls.setMicGain = (gain) => {
        gainNode.gain.setValueAtTime(gain, audioContext.currentTime);
      };
      
      // Contrôles spatiaux pour MacBook Air M4
      if (pannerNode) {
        window.volumeAdaptiveControls.setSpatialPosition = (x, y, z) => {
          pannerNode.setPosition(x, y, z);
        };
        
        window.volumeAdaptiveControls.setSpatialOrientation = (x, y, z) => {
          pannerNode.setOrientation(x, y, z);
        };
      }
      
      if (spatialProcessor) {
        window.volumeAdaptiveControls.updateSpatialParams = (params) => {
          spatialProcessor.port.postMessage({
            type: 'UPDATE_SPATIAL_PARAMS',
            data: params
          });
        };
      }
      
      return destination.stream;
    }
    
    createAdvancedEchoSuppressor(audioContext) {
      // Créer un suppresseur d'écho avancé optimisé pour les microphones MacBook Air
      const delayNode = audioContext.createDelay(0.3);
      const feedbackGain = audioContext.createGain();
      const filterNode = audioContext.createBiquadFilter();
      
      // Configuration optimisée pour les microphones MacBook Air M4
      delayNode.delayTime.setValueAtTime(0.02, audioContext.currentTime); // 20ms de délai
      feedbackGain.gain.setValueAtTime(-0.7, audioContext.currentTime); // Feedback négatif
      
      // Filtre passe-haut pour éliminer les basses fréquences d'écho
      filterNode.type = 'highpass';
      filterNode.frequency.setValueAtTime(80, audioContext.currentTime);
      filterNode.Q.setValueAtTime(0.7, audioContext.currentTime);
      
      // Connecter le circuit de suppression d'écho
      const inputGain = audioContext.createGain();
      const outputGain = audioContext.createGain();
      
      inputGain.connect(outputGain);
      inputGain.connect(delayNode);
      delayNode.connect(filterNode);
      filterNode.connect(feedbackGain);
      feedbackGain.connect(outputGain);
      
      // Retourner le nœud d'entrée et de sortie
      return {
        input: inputGain,
        output: outputGain,
        connect: (destination) => outputGain.connect(destination),
        disconnect: () => outputGain.disconnect()
      };
    }
    
    interceptAudioCreation() {
      // Intercepter la création d'éléments Audio
      const originalAudio = window.Audio;
      
      window.Audio = function(src) {
        const audio = new originalAudio(src);
        
        // Marquer pour traitement par l'extension
        audio.dataset = audio.dataset || {};
        audio.dataset.volumeEnhanced = 'true';
        
        return audio;
      };
      
      // Préserver le prototype
      window.Audio.prototype = originalAudio.prototype;
    }
  }
  
  // Initialiser l'améliorateur audio
  const audioEnhancer = new AudioEnhancer();
  
  // Signaler que le script d'injection est prêt
  document.dispatchEvent(new CustomEvent('volumeAdaptiveReady', {
    detail: { version: '1.0.0', timestamp: Date.now() }
  }));
  
})();
