// popup.js

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const powerBtn         = document.getElementById('powerButton');
  const statusDot        = document.getElementById('statusDot');
  const statusText       = document.getElementById('statusText');
  const noiseValue       = document.getElementById('noiseValue');
  const noiseFill        = document.getElementById('noiseFill');
  const speakerGainVal   = document.getElementById('speakerGainValue');
  const speakerGainFill  = document.getElementById('speakerGainFill');
  const micGainVal       = document.getElementById('micGainValue');
  const micGainFill      = document.getElementById('micGainFill');
  const calibrateBtn     = document.getElementById('calibrateButton');
  const settingsBtn      = document.getElementById('settingsButton');
  const sensBtns         = document.querySelectorAll('.sensitivity-btn');
  
  // Nouveaux éléments pour l'audio spatial
  const spatialSection   = document.getElementById('spatialSection');
  const spatialToggle    = document.getElementById('spatialToggle');
  const participantCount = document.getElementById('participantCount');
  const spatialSettingsBtn = document.getElementById('spatialSettingsButton');

  // --- State ---
  let isActive = false;
  let currentSettings = {};
  let isMacBookAirM4 = false;
  let spatialEnabled = false;

  // --- UI Update Functions ---
  function updateStatusUI() {
    statusDot.className = isActive ? 'status-dot active' : 'status-dot inactive';
    statusText.textContent = isActive ? 'Actif' : 'Inactif';
    powerBtn.querySelector('.power-text').textContent = isActive ? 'Désactiver' : 'Activer';
    document.body.classList.toggle('active', isActive);
  }

  function updateGainsUI(data) {
      const { noiseLevel, speakerGain, micGain } = data;
      // Niveau de bruit
      noiseValue.textContent = `${Math.round(noiseLevel)} dB`;
      noiseFill.style.width = `${Math.min(100, noiseLevel / 100 * 100)}%`;
      // Gain haut-parleur
      speakerGainVal.textContent = `${Math.round(speakerGain*100)}%`;
      speakerGainFill.style.width = `${Math.min(100, speakerGain*100 / 2)}%`;
      // Gain microphone
      micGainVal.textContent = `${Math.round(micGain*100)}%`;
      micGainFill.style.width = `${Math.min(100, micGain*100 / 2)}%`;
  }

  function updateSensitivityUI(sensitivity) {
      sensBtns.forEach(b => {
          b.classList.toggle('active', b.dataset.level === sensitivity);
      });
  }
  
  function updateSpatialUI(data) {
    if (data.isMacBookAirM4 !== undefined) {
      isMacBookAirM4 = data.isMacBookAirM4;
      // Afficher la section si la fonctionnalité M4 est activée
      spatialSection.style.display = isMacBookAirM4 ? 'block' : 'none';
      spatialSettingsBtn.style.display = isMacBookAirM4 ? 'inline-block' : 'none';
    }
    
    if (data.spatialElementsCount !== undefined) {
      participantCount.textContent = `${data.spatialElementsCount} participants`;
    }
  }

  // --- Event Listeners ---
  powerBtn.addEventListener('click', () => {
    isActive = !isActive;
    chrome.runtime.sendMessage({ type: 'TOGGLE_ACTIVATION', active: isActive }, (response) => {
        if(chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            // Revert state if message failed
            isActive = !isActive;
        } else {
            isActive = response.isActive;
        }
        updateStatusUI();
    });
  });

  calibrateBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.runtime.sendMessage({ type: 'START_CALIBRATION' });
        // Maybe show some "calibrating..." message
    });
  });

  sensBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sensitivity = btn.dataset.level;
      updateSensitivityUI(sensitivity);
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: { sensitivity } });
    });
  });

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  spatialToggle.addEventListener('click', () => {
    spatialEnabled = spatialToggle.checked;
    chrome.storage.sync.set({ spatialAudioEnabled: spatialEnabled });
    // Potentiellement envoyer un message pour activer/désactiver l'effet immédiatement
  });

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'VOLUME_UPDATE') {
      updateGainsUI(msg.data);
    }
  });

  // --- Initialization ---
  async function initialize() {
    // Charger l'état et les paramètres depuis le stockage
    const data = await chrome.storage.sync.get(['volumeActive', 'volumeSettings', 'spatialAudioEnabled']);

    isActive = data.volumeActive || false;
    spatialEnabled = data.spatialAudioEnabled || false;
    spatialToggle.checked = spatialEnabled;

    if (data.volumeSettings) {
        currentSettings = data.volumeSettings;
        updateSensitivityUI(currentSettings.sensitivity);
    }
    updateStatusUI();

    // Obtenir le statut de l'onglet actif
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
            if (response) {
                updateSpatialUI(response);
            }
        } catch (e) {
            console.warn("L'onglet actif ne répond pas, peut-être une page protégée.", e);
            spatialSection.style.display = 'none';
        }
    }
  }

  // Écouter les changements de paramètres pour garder l'UI synchronisée
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.volumeSettings) {
      currentSettings = changes.volumeSettings.newValue;
      updateSensitivityUI(currentSettings.sensitivity);
    }
  });

  initialize().catch(console.error);
});
