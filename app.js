// Algorithme principal de volume adaptatif
export class AdaptiveVolumeAlgorithm {
  constructor(options = {}) {
    this.referenceLevel = options.referenceLevel || 35;
    this.sensitivity = options.sensitivity || 'medium';
    this.updateInterval = options.updateInterval || 200;
    this.history = [];
    this.maxHistory = 50;
    
    // La détection du matériel est gérée par le script de fond
    this.isMacBookAirM4 = false;
    
    // Paramètres de l'algorithme optimisés pour M4
    this.params = {
      low: { 
        k_positive: this.isMacBookAirM4 ? 0.025 : 0.02, 
        k_negative: this.isMacBookAirM4 ? 0.012 : 0.01, 
        smoothing: 0.9 
      },
      medium: { 
        k_positive: this.isMacBookAirM4 ? 0.045 : 0.04, 
        k_negative: this.isMacBookAirM4 ? 0.025 : 0.02, 
        smoothing: 0.85 
      },
      high: { 
        k_positive: this.isMacBookAirM4 ? 0.065 : 0.06, 
        k_negative: this.isMacBookAirM4 ? 0.035 : 0.03, 
        smoothing: 0.8 
      }
    };
    
    // État interne
    this.currentGains = { speaker: 1.0, mic: 1.0 };
    this.lastUpdate = 0;
    this.isAdapting = false;
    this.adaptiveThreshold = 0.6; // Seuil adaptatif pour la détection vocale
    
    // Optimisations M4
    if (this.isMacBookAirM4) {
      this.enableM4Optimizations();
    }
  }
  
  enableM4Optimizations() {
    // Optimisations spécifiques au MacBook Air M4
    this.updateInterval = 150; // Traitement plus rapide grâce au M4
    this.maxHistory = 100; // Plus d'historique grâce à la mémoire unifiée
    
    // Paramètres avancés pour M4
    this.m4Config = {
      useNeuralEngine: true,
      enhancedDSP: true,
      parallelProcessing: true,
      memoryOptimized: true,
      spatialAudioEnabled: true
    };
    
    console.log('Optimisations MacBook Air M4 activées');
  }
  
  // Fonction principale de calcul des gains
  calculateGains(currentNoiseLevel, timestamp = Date.now()) {
    // Validation des paramètres d'entrée
    if (typeof currentNoiseLevel !== 'number' || isNaN(currentNoiseLevel)) {
      console.warn('Invalid noise level provided to calculateGains:', currentNoiseLevel);
      return this.currentGains;
    }
    
    if (typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
      console.warn('Invalid timestamp provided to calculateGains:', timestamp);
      timestamp = Date.now();
    }
    
    // Éviter les mises à jour trop fréquentes
    if (timestamp - this.lastUpdate < this.updateInterval) {
      return this.currentGains;
    }
    
    // Ajouter à l'historique
    this.addToHistory(currentNoiseLevel, timestamp);
    
    // Calculer l'écart par rapport au niveau de référence
    const deltaB = currentNoiseLevel - this.referenceLevel;
    
    // Obtenir les paramètres selon la sensibilité
    const param = this.params[this.sensitivity] || this.params.medium;
    
    // Calculer le gain selon la formule adaptative
    let gain;
    if (deltaB > 0) {
      // Augmentation du bruit - augmenter le gain
      gain = 1 + param.k_positive * deltaB;
    } else {
      // Diminution du bruit - diminuer le gain
      gain = 1 + param.k_negative * deltaB;
    }
    
    // Appliquer le lissage temporel
    const targetSpeakerGain = Math.max(0.1, Math.min(3.0, gain));
    const targetMicGain = Math.max(0.1, Math.min(2.0, gain * 0.8));
    
    // Lissage exponentiel pour éviter les variations brusques
    this.currentGains.speaker = this.exponentialSmoothing(
      this.currentGains.speaker,
      targetSpeakerGain,
      1 - param.smoothing
    );
    
    this.currentGains.mic = this.exponentialSmoothing(
      this.currentGains.mic,
      targetMicGain,
      1 - param.smoothing
    );
    
    this.lastUpdate = timestamp;
    
    return {
      speaker: this.currentGains.speaker,
      mic: this.currentGains.mic,
      deltaB: deltaB,
      noiseLevel: currentNoiseLevel,
      timestamp: timestamp
    };
  }
  
  // Lissage exponentiel
  exponentialSmoothing(current, target, alpha) {
    return alpha * target + (1 - alpha) * current;
  }
  
  // Ajouter une mesure à l'historique
  addToHistory(noiseLevel, timestamp) {
    this.history.push({ noiseLevel, timestamp });
    
    // Limiter la taille de l'historique
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
  
  // Calibration automatique
  async calibrate(duration = 3000, sampleInterval = 100) {
    const samples = [];
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const sampleTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= duration) {
          clearInterval(sampleTimer);
          
          // Calculer le niveau de référence
          if (samples.length > 0) {
            // Utiliser la médiane pour plus de robustesse
            samples.sort((a, b) => a - b);
            const median = samples[Math.floor(samples.length / 2)];
            this.referenceLevel = median;
            
            resolve({
              referenceLevel: this.referenceLevel,
              samples: samples.length,
              duration: elapsed
            });
          } else {
            resolve(null);
          }
        }
      }, sampleInterval);
      
      // Interface pour ajouter des échantillons
      this.calibrationSampler = (noiseLevel) => {
        samples.push(noiseLevel);
      };
    });
  }
  
  // Mise à jour de la sensibilité
  setSensitivity(level) {
    if (typeof level !== 'string') {
      console.warn('Invalid sensitivity level type:', typeof level);
      return false;
    }
    
    if (this.params[level]) {
      this.sensitivity = level;
      return true;
    }
    
    console.warn('Unknown sensitivity level:', level);
    return false;
  }
  
  // Obtenir les statistiques
  getStatistics() {
    if (this.history.length === 0) return null;
    
    const recent = this.history.slice(-10);
    const levels = recent.map(h => h.noiseLevel);
    
    return {
      currentLevel: levels[levels.length - 1],
      averageLevel: levels.reduce((a, b) => a + b, 0) / levels.length,
      minLevel: Math.min(...levels),
      maxLevel: Math.max(...levels),
      variance: this.calculateVariance(levels),
      samplesCount: this.history.length,
      currentGains: { ...this.currentGains }
    };
  }
  
  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }
}
