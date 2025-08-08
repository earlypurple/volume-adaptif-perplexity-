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


// Données de l'application
const appData = {
  extension_info: {
    name: "Volume Adaptatif Pro",
    version: "1.0.0",
    description: "Extension professionnelle de contrôle automatique du volume pour conférences vidéo"
  },
  environments: [
    { name: "Bureau silencieux", base_level: 35, variation: 5 },
    { name: "Bureau ouvert",      base_level: 45, variation: 8 },
    { name: "Café",               base_level: 55, variation: 12 },
    { name: "Rue passante",       base_level: 65, variation: 15 },
    { name: "Construction",       base_level: 75, variation: 20 }
  ],
  conference_platforms: [
    { name: "Zoom",             domain: "zoom.us",            default_gain: 1.2 },
    { name: "Microsoft Teams",  domain: "teams.microsoft.com", default_gain: 1.1 },
    { name: "Google Meet",      domain: "meet.google.com",     default_gain: 1.0 },
    { name: "Webex",            domain: "webex.com",           default_gain: 1.15 }
  ],
  algorithm_params: {
    sensitivity_low:    { k_positive: 0.02, k_negative: 0.01 },
    sensitivity_medium: { k_positive: 0.04, k_negative: 0.02 },
    sensitivity_high:   { k_positive: 0.06, k_negative: 0.03 },
    update_interval: 200,
    calibration_duration: 3000
  }
};

// Variables globales
let isActive = false;
let currentEnvIndex = 0;
let sensitivity = 'medium';
let referenceLevel = appData.environments[0].base_level;
let realtimeChart, perfChart;
let simInterval;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initCharts();
  loadEnvironments();
});

// Initialiser l'interface
function initUI() {
  const envSelect = document.getElementById('envSelect');
  document.getElementById('startSim').addEventListener('click', () => {
    startSimulation(envSelect.value);
  });
}

// Charger la liste d'environnements
function loadEnvironments() {
  const envSelect = document.getElementById('envSelect');
  appData.environments.forEach((env, idx) => {
    const option = document.createElement('option');
    option.value = idx;
    option.textContent = env.name;
    envSelect.appendChild(option);
  });
}

// Initialiser les graphiques Chart.js
function initCharts() {
  const rtCtx = document.getElementById('realtimeChart').getContext('2d');
  realtimeChart = new Chart(rtCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Niveau de bruit (dB)', data: [], borderColor: '#3498db', fill: false },
        { label: 'Gain haut-parleur',   data: [], borderColor: '#e67e22', fill: false }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      scales: {
        y: { suggestedMin: 0 }
      }
    }
  });

  const pfCtx = document.getElementById('perfChart').getContext('2d');
  perfChart = new Chart(pfCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'Latence (ms)', data: [], backgroundColor: '#2ecc71' },
        { label: 'CPU (%)',      data: [], backgroundColor: '#e74c3c' }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { suggestedMin: 0 }
      }
    }
  });
}

function updateRealtimeChart(time, noise, gain) {
  realtimeChart.data.labels.push(time);
  realtimeChart.data.datasets[0].data.push(noise);
  realtimeChart.data.datasets[1].data.push(gain);

  if (realtimeChart.data.labels.length > 20) {
    realtimeChart.data.labels.shift();
    realtimeChart.data.datasets[0].data.shift();
    realtimeChart.data.datasets[1].data.shift();
  }
  realtimeChart.update();
}

function updatePerfChart(time, latency, cpu) {
    perfChart.data.labels.push(time);
    perfChart.data.datasets[0].data.push(latency);
    perfChart.data.datasets[1].data.push(cpu);

    if (perfChart.data.labels.length > 20) {
        perfChart.data.labels.shift();
        perfChart.data.datasets[0].data.shift();
        perfChart.data.datasets[1].data.shift();
    }
    perfChart.update();
}

// Démarrer la simulation
function startSimulation(envIndex) {
  clearInterval(simInterval);
  currentEnvIndex = parseInt(envIndex, 10);
  const env = appData.environments[currentEnvIndex];

  simInterval = setInterval(() => {
    // Générer niveau de bruit simulé
    const noise = env.base_level + (Math.random() * 2 - 1) * env.variation;
    // Calculer gain selon algorithme simple
    const params = appData.algorithm_params[`sensitivity_${sensitivity}`];
    const deltaB = noise - referenceLevel;
    let gainRaw;
    if (deltaB > 0) {
      gainRaw = 1 + params.k_positive * deltaB;
    } else {
      gainRaw = 1 + params.k_negative * deltaB;
    }
    const speakerGain = Math.min(Math.max(gainRaw, 0.1), 3.0);

    // Mettre à jour graphiques
    const time = new Date().toLocaleTimeString();
    updateRealtimeChart(time, noise.toFixed(1), speakerGain.toFixed(2));
    updatePerfChart(time, (Math.random() * 50 + 10).toFixed(0), (Math.random() * 15).toFixed(2));
  }, 500);
}
