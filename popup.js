// popup.js

document.addEventListener('DOMContentLoaded', () => {
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

  let isActive = false;
  let sensitivity = 'medium';

  // Met à jour l'affichage de l'état
  function updateStatus() {
    statusDot.className = isActive ? 'status-dot active' : 'status-dot inactive';
    statusText.textContent = isActive ? 'Actif' : 'Inactif';
    powerBtn.querySelector('.power-text').textContent = isActive ? 'Désactiver' : 'Activer';
  }

  // Envoie un message au background pour activer/désactiver
  powerBtn.addEventListener('click', () => {
    isActive = !isActive;
    chrome.runtime.sendMessage({ type: 'ACTIVATE_VOLUME_CONTROL', active: isActive });
    updateStatus();
  });

  // Réception des niveaux de bruit et gains
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'VOLUME_UPDATE') {
      const { noiseLevel, speakerGain, micGain } = msg.data;
      // Niveau de bruit
      noiseValue.textContent = `${Math.round(noiseLevel)} dB`;
      noiseFill.style.width = `${Math.min(100, noiseLevel)}%`;
      // Gain haut-parleur
      speakerGainVal.textContent = `${Math.round(speakerGain*100)}%`;
      speakerGainFill.style.width = `${Math.min(200, speakerGain*100)}%`;
      // Gain microphone
      micGainVal.textContent = `${Math.round(micGain*100)}%`;
      micGainFill.style.width = `${Math.min(200, micGain*100)}%`;
    }
  });

  // Calibration
  calibrateBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'START_CALIBRATION' });
  });

  // Sensibilité
  sensBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sensBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sensitivity = btn.dataset.level;
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: { sensitivity } });
    });
  });

  // Ouvrir page paramètres
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Initialisation
  updateStatus();
});
