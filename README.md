# Volume Adaptatif Pro 2.0 🎧

## Description
Volume Adaptatif Pro est une extension de navigateur MV3 pour **Chrome** et **Firefox** qui ajuste automatiquement :
- le volume des haut-parleurs (retour audio)
- le gain du microphone  
en fonction du **bruit ambiant** lors des conférences vidéo (Zoom, Teams, Meet, Webex…).

### 🚀 Nouveau : Audio Spatial pour MacBook Air M4 2025
Version 2.0 avec support complet de l'audio spatial optimisé pour les dernières technologies :
- **Audio spatial 3D** avec positionnement des participants
- **Intelligence Artificielle** pour la détection vocale avancée
- **Optimisations MacBook Air M4** utilisant le Neural Engine
- **AudioWorklet** pour des performances maximales
- **Suppression d'écho avancée** pour les microphones MacBook Air

## Fonctionnalités
1. **Contrôle Adaptatif**  
   - Mesure en continu le niveau de bruit (dB)
   - Algorithme adaptatif avec calibration initiale  
2. **Interface Popup**  
   - Bouton ON/OFF  
   - Affichage temps réel du niveau de bruit  
   - Curseur de sensibilité (Faible/Moyen/Élevé)  
   - Calibration manuelle  
3. **Traitement Audio**  
   - Web Audio API (AnalyserNode, GainNode, CompressorNode)  
   - Suppression adaptative de l’écho  
   - Priorité vocale  
4. **Profils par Domaine**  
   - Zoom, Teams, Meet, Webex  
   - Réglages sauvegardés par domaine  
5. **Pages Avancées**  
   - Paramètres détaillés  
   - Démo technique avec simulation  
   - Code source intégré  

## Installation
1. Cloner ce dépôt.  
2. Ouvrir Chrome/Firefox → Extensions → Mode développeur.  
3. Cliquer sur « Charger l’extension non empaquetée » et sélectionner le dossier `volume-adaptatif-pro`.  
4. Autoriser l’accès au microphone et l’injection de scripts sur les domaines de conférence.

## Structure du projet
volume-adaptatif-pro/ ├── manifest.json ├── background.js ├── content.js ├── inject.js ├── popup.html ├── popup.css ├── popup.js ├── style.css ├── app.js ├── icons/ │   ├── icon16.png │   ├── icon32.png │   ├── icon48.png │   └── icon128.png ├── pages/ │   ├── settings.html │   ├── demo.html │   └── code.html └── README.md

## Déploiement
- Publier sur Chrome Web Store & Mozilla Add-ons.  
- Mises à jour automatiques via le store.  

---
Cette extension assure une **qualité audio optimale** en toute situation de conférence vidéo.
