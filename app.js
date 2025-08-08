// Algorithme principal de volume adaptatif
export class AdaptiveVolumeAlgorithm {
  constructor(options = {}) {
    this.referenceLevel = options.referenceLevel || 35;
    this.sensitivity = options.sensitivity || 'medium';
    this.updateInterval = options.updateInterval || 200;
    this.history = [];
    this.maxHistory = 50;
    
    // Paramètres de l'algorithme
    this.params = {
      low: { k_positive: 0.02, k_negative: 0.01, smoothing: 0.9 },
      medium: { k_positive: 0.04, k_negative: 0.02, smoothing: 0.85 },
      high: { k_positive: 0.06, k_negative: 0.03, smoothing: 0.8 }
    };
    
    // État interne
    this.currentGains = { speaker: 1.0, mic: 1.0 };
    this.lastUpdate = 0;
    this.isAdapting = false;
  }
  
  // Fonction principale de calcul des gains
  calculateGains(currentNoiseLevel, timestamp = Date.now()) {
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
  
  // Détection de la parole (mode priorité vocale)
  detectSpeech(frequencyData) {
    // Analyser les fréquences vocales (300Hz - 3400Hz)
    const voiceStart = Math.floor(300 * frequencyData.length / 22050);
    const voiceEnd = Math.floor(3400 * frequencyData.length / 22050);
    
    let voiceEnergy = 0;
    let totalEnergy = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      const power = Math.pow(10, frequencyData[i] / 10);
      totalEnergy += power;
      
      if (i >= voiceStart && i <= voiceEnd) {
        voiceEnergy += power;
      }
    }
    
    // Ratio d'énergie vocale
    const voiceRatio = voiceEnergy / totalEnergy;
    
    return {
      isSpeech: voiceRatio > 0.3,
      voiceRatio: voiceRatio,
      confidence: Math.min(voiceRatio / 0.3, 1.0)
    };
  }
  
  // Mise à jour de la sensibilité
  setSensitivity(level) {
    if (this.params[level]) {
      this.sensitivity = level;
      return true;
    }
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
