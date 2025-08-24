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
      spatialSection.style.display = isMacBookAirM4 ? 'block' : 'none';
      spatialSettingsBtn.style.display = isMacBookAirM4 ? 'inline-block' : 'none';
    }
    
    if (data.spatialElementsCount !== undefined) {
      participantCount.textContent = `${data.spatialElementsCount} participants`;
    }
  }
  
  function detectM4Features() {
    // Détection côté popup des fonctionnalités M4
    const userAgent = navigator.userAgent.toLowerCase();
    const isMac = userAgent.includes('mac');
    const hasAdvancedAudio = 'AudioWorklet' in window;
    const hasM4Features = navigator.hardwareConcurrency >= 8;
    
    const detected = isMac && hasAdvancedAudio && hasM4Features;
    updateSpatialUI({ isMacBookAirM4: detected });
    
    return detected;
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
  
  // Nouveaux événements pour l'audio spatial
  spatialToggle.addEventListener('change', () => {
    spatialEnabled = spatialToggle.checked;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_SPATIAL_AUDIO',
          enabled: spatialEnabled
        });
      }
    });
    
    // Sauvegarder la préférence
    chrome.storage.sync.set({ spatialAudioEnabled: spatialEnabled });
  });
  
  spatialSettingsBtn.addEventListener('click', () => {
    // Ouvrir une page de paramètres spatiaux avancés
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/spatial.html') });
  });

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'VOLUME_UPDATE') {
      updateGainsUI(msg.data);
    }
  });

  // --- Initialization ---
  function initialize() {
      // Détecter les fonctionnalités M4
      detectM4Features();
      
      chrome.storage.sync.get(['volumeActive', 'volumeSettings', 'spatialAudioEnabled'], (result) => {
          isActive = result.volumeActive || false;
          spatialEnabled = result.spatialAudioEnabled || false;
          spatialToggle.checked = spatialEnabled;
          
          if (result.volumeSettings) {
              currentSettings = result.volumeSettings;
              updateSensitivityUI(currentSettings.sensitivity);
          }
          updateStatusUI();
          
          // Obtenir le statut des éléments spatiaux
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' }, (response) => {
                if (response && !chrome.runtime.lastError) {
                  updateSpatialUI(response);
                }
              });
            }
          });
      });
  }

  initialize();
});
