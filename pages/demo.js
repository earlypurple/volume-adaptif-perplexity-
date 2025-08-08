// Données de l'application pour la démo
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

// Variables globales pour la démo
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
  let currentEnvIndex = parseInt(envIndex, 10);
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
