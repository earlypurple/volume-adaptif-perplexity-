// popup.js

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const powerBtn       = document.getElementById('powerButton');
  const statusDot      = document.getElementById('statusDot');
  const statusText     = document.getElementById('statusText');
  const noiseValue     = document.getElementById('noiseValue');
  const noiseFill      = document.getElementById('noiseFill');
  const speakerGainVal = document.getElementById('speakerGainValue');
  const speakerGainFill= document.getElementById('speakerGainFill');
  const micGainVal     = document.getElementById('micGainValue');
  const micGainFill    = document.getElementById('micGainFill');
  const calibrateBtn   = document.getElementById('calibrateButton');
  const settingsBtn    = document.getElementById('settingsButton');
  const sensBtns       = document.querySelectorAll('.sensitivity-btn');

  // --- State ---
  let isActive = false;
  let currentSettings = {};

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

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'VOLUME_UPDATE') {
      updateGainsUI(msg.data);
    }
  });

  // --- Initialization ---
  function initialize() {
      chrome.storage.sync.get(['volumeActive', 'volumeSettings'], (result) => {
          isActive = result.volumeActive || false;
          if (result.volumeSettings) {
              currentSettings = result.volumeSettings;
              updateSensitivityUI(currentSettings.sensitivity);
          }
          updateStatusUI();
      });
  }

  initialize();
});
