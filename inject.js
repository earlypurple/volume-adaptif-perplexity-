// Script injecté directement dans le contexte de la page
(function() {
  'use strict';
  
  // Améliorer la Web Audio API pour les conférences vidéo
  class AudioEnhancer {
    constructor() {
      this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      this.enhancedStreams = new Map();
      this.init();
    }
    
    init() {
      // Intercepter les appels getUserMedia
      navigator.mediaDevices.getUserMedia = this.enhancedGetUserMedia.bind(this);
      
      // Intercepter les créations d'éléments audio
      this.interceptAudioCreation();
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
      
      // Créer la chaîne de traitement
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      const compressor = audioContext.createDynamicsCompressor();
      const destination = audioContext.createMediaStreamDestination();
      
      // Configurer le compresseur pour la voix
      compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
      compressor.knee.setValueAtTime(30, audioContext.currentTime);
      compressor.ratio.setValueAtTime(12, audioContext.currentTime);
      compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
      compressor.release.setValueAtTime(0.25, audioContext.currentTime);
      
      // Connecter la chaîne
      source.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(destination);
      
      // Stocker les références pour contrôle externe
      const enhancedInfo = {
        originalStream: stream,
        audioContext: audioContext,
        gainNode: gainNode,
        compressor: compressor
      };
      
      this.enhancedStreams.set(destination.stream, enhancedInfo);
      
      // Exposer les contrôles via l'objet window pour l'extension
      window.volumeAdaptiveControls = window.volumeAdaptiveControls || {};
      window.volumeAdaptiveControls.setMicGain = (gain) => {
        gainNode.gain.setValueAtTime(gain, audioContext.currentTime);
      };
      
      return destination.stream;
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
