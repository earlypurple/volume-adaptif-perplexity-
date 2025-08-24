// Gestionnaire des paramètres audio spatial
class SpatialAudioSettings {
    constructor() {
        this.settings = {
            roomSize: 10,
            reverbTime: 0.3,
            diffusion: 0.7,
            stereoWidth: 1.2,
            voiceThreshold: 0.3,
            neuralAdaptation: 0.8,
            binauralEnhancement: 0.6
        };
        
        this.participantPositions = new Map();
        this.visualizer = null;
        this.animationId = null;
        
        this.init();
    }
    
    init() {
        this.initializeControls();
        this.initializeVisualizer();
        this.loadSettings();
        this.bindEvents();
        this.startVisualization();
    }
    
    initializeControls() {
        // Initialiser tous les sliders
        const sliders = {
            roomSize: { element: 'roomSize', value: 'roomSizeValue', suffix: 'm', multiplier: 1 },
            reverbTime: { element: 'reverbTime', value: 'reverbTimeValue', suffix: 's', multiplier: 0.01 },
            diffusion: { element: 'diffusion', value: 'diffusionValue', suffix: '%', multiplier: 1 },
            stereoWidth: { element: 'stereoWidth', value: 'stereoWidthValue', suffix: '%', multiplier: 1 },
            voiceThreshold: { element: 'voiceThreshold', value: 'voiceThresholdValue', suffix: '%', multiplier: 1 },
            neuralAdaptation: { element: 'neuralAdaptation', value: 'neuralAdaptationValue', suffix: '%', multiplier: 1 },
            binauralEnhancement: { element: 'binauralEnhancement', value: 'binauralEnhancementValue', suffix: '%', multiplier: 1 }
        };
        
        Object.entries(sliders).forEach(([key, config]) => {
            const slider = document.getElementById(config.element);
            const valueDisplay = document.getElementById(config.value);
            
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value) * config.multiplier;
                this.settings[key] = value;
                valueDisplay.textContent = `${e.target.value}${config.suffix}`;
                this.updateSpatialProcessor();
            });
        });
    }
    
    initializeVisualizer() {
        const canvas = document.getElementById('spatialVisualizer');
        this.visualizer = {
            canvas: canvas,
            ctx: canvas.getContext('2d'),
            width: canvas.offsetWidth,
            height: canvas.offsetHeight,
            particles: []
        };
        
        // Ajuster la taille du canvas
        canvas.width = this.visualizer.width * window.devicePixelRatio;
        canvas.height = this.visualizer.height * window.devicePixelRatio;
        this.visualizer.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Initialiser les particules pour la visualisation
        this.initializeParticles();
    }
    
    initializeParticles() {
        this.visualizer.particles = [];
        
        // Créer des particules pour représenter les ondes sonores
        for (let i = 0; i < 50; i++) {
            this.visualizer.particles.push({
                x: Math.random() * this.visualizer.width,
                y: Math.random() * this.visualizer.height,
                radius: Math.random() * 3 + 1,
                speed: Math.random() * 2 + 0.5,
                angle: Math.random() * Math.PI * 2,
                opacity: Math.random() * 0.5 + 0.2,
                color: `hsl(${220 + Math.random() * 40}, 70%, ${50 + Math.random() * 30}%)`
            });
        }
    }
    
    bindEvents() {
        // Gestionnaires des positions des participants
        document.querySelectorAll('.participant-position').forEach(position => {
            position.addEventListener('click', (e) => {
                if (!e.target.classList.contains('active')) {
                    this.assignParticipantToPosition(e.target.dataset.position);
                }
            });
        });
        
        // Boutons d'action
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetSettings();
        });
        
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveSettings();
        });
        
        document.getElementById('testBtn').addEventListener('click', () => {
            this.testSpatialAudio();
        });
    }
    
    assignParticipantToPosition(position) {
        // Trouver une position libre
        const positionElements = document.querySelectorAll('.participant-position');
        const targetElement = document.querySelector(`[data-position="${position}"]`);
        
        if (targetElement && !targetElement.classList.contains('active')) {
            // Trouver le premier participant occupé et le déplacer
            const occupiedElements = document.querySelectorAll('.participant-position.occupied');
            if (occupiedElements.length > 0) {
                const firstOccupied = occupiedElements[0];
                firstOccupied.classList.remove('occupied');
                targetElement.classList.add('occupied');
                targetElement.textContent = firstOccupied.textContent;
                firstOccupied.textContent = firstOccupied.dataset.position.replace('-', ' ');
            }
            
            this.updateParticipantPositions();
        }
    }
    
    updateParticipantPositions() {
        const positions = [];
        
        document.querySelectorAll('.participant-position.occupied').forEach((element, index) => {
            const pos = this.getPositionCoordinates(element.dataset.position);
            positions.push(pos);
        });
        
        // Envoyer les nouvelles positions au content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'UPDATE_SPATIAL_POSITIONS',
                    positions: positions
                });
            }
        });
    }
    
    getPositionCoordinates(position) {
        const positions = {
            'left-back': { x: -3, y: 1, z: -2 },
            'center-back': { x: 0, y: 1, z: -3 },
            'right-back': { x: 3, y: 1, z: -2 },
            'left': { x: -2, y: 0, z: -1 },
            'center': { x: 0, y: 0, z: -1 },
            'right': { x: 2, y: 0, z: -1 },
            'left-front': { x: -1, y: -1, z: 0 },
            'center-front': { x: 0, y: -1, z: 1 },
            'right-front': { x: 1, y: -1, z: 0 }
        };
        
        return positions[position] || { x: 0, y: 0, z: -1 };
    }
    
    updateSpatialProcessor() {
        // Envoyer les nouveaux paramètres au processeur spatial
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'UPDATE_SPATIAL_PARAMS',
                    params: this.settings
                });
            }
        });
    }
    
    startVisualization() {
        const animate = () => {
            this.drawVisualization();
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    drawVisualization() {
        const { ctx, width, height, particles } = this.visualizer;
        
        // Effacer le canvas avec un dégradé sombre
        const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width/2);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f0f1a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Dessiner le centre (utilisateur)
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(width/2, height/2, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Dessiner les particules (ondes sonores)
        particles.forEach(particle => {
            // Mise à jour de la position
            particle.x += Math.cos(particle.angle) * particle.speed;
            particle.y += Math.sin(particle.angle) * particle.speed;
            
            // Rebondir sur les bords
            if (particle.x < 0 || particle.x > width) particle.angle = Math.PI - particle.angle;
            if (particle.y < 0 || particle.y > height) particle.angle = -particle.angle;
            
            // Garder dans les limites
            particle.x = Math.max(0, Math.min(width, particle.x));
            particle.y = Math.max(0, Math.min(height, particle.y));
            
            // Effet spatial basé sur la distance du centre
            const distanceFromCenter = Math.sqrt(
                Math.pow(particle.x - width/2, 2) + 
                Math.pow(particle.y - height/2, 2)
            );
            
            const spatialOpacity = particle.opacity * (1 - distanceFromCenter / (width/2)) * this.settings.stereoWidth;
            
            // Dessiner la particule
            ctx.fillStyle = particle.color.replace(')', `, ${spatialOpacity})`).replace('hsl', 'hsla');
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Dessiner les positions des participants
        this.drawParticipantPositions();
    }
    
    drawParticipantPositions() {
        const { ctx, width, height } = this.visualizer;
        
        document.querySelectorAll('.participant-position.occupied').forEach(element => {
            const pos = this.getPositionCoordinates(element.dataset.position);
            
            // Convertir les coordonnées 3D en 2D pour l'affichage
            const x = width/2 + (pos.x / 4) * width/2;
            const y = height/2 + (pos.z / 4) * height/2;
            
            // Dessiner le participant
            ctx.fillStyle = 'rgba(118, 75, 162, 0.8)';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Dessiner une ligne vers le centre pour montrer la connexion
            ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(width/2, height/2);
            ctx.lineTo(x, y);
            ctx.stroke();
        });
    }
    
    loadSettings() {
        chrome.storage.sync.get(['spatialAudioSettings'], (result) => {
            if (result.spatialAudioSettings) {
                this.settings = { ...this.settings, ...result.spatialAudioSettings };
                this.updateUIFromSettings();
            }
        });
    }
    
    updateUIFromSettings() {
        // Mettre à jour tous les sliders avec les valeurs sauvegardées
        const updates = {
            roomSize: { value: this.settings.roomSize, suffix: 'm' },
            reverbTime: { value: Math.round(this.settings.reverbTime * 100), suffix: 's' },
            diffusion: { value: Math.round(this.settings.diffusion * 100), suffix: '%' },
            stereoWidth: { value: Math.round(this.settings.stereoWidth * 100), suffix: '%' },
            voiceThreshold: { value: Math.round(this.settings.voiceThreshold * 100), suffix: '%' },
            neuralAdaptation: { value: Math.round(this.settings.neuralAdaptation * 100), suffix: '%' },
            binauralEnhancement: { value: Math.round(this.settings.binauralEnhancement * 100), suffix: '%' }
        };
        
        Object.entries(updates).forEach(([key, config]) => {
            const slider = document.getElementById(key);
            const valueDisplay = document.getElementById(key + 'Value');
            
            if (slider && valueDisplay) {
                slider.value = config.value;
                valueDisplay.textContent = `${config.value}${config.suffix}`;
            }
        });
    }
    
    saveSettings() {
        chrome.storage.sync.set({ spatialAudioSettings: this.settings }, () => {
            // Afficher une confirmation
            const saveBtn = document.getElementById('saveBtn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '✓ Sauvegardé';
            saveBtn.style.background = '#28a745';
            
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.background = '';
            }, 2000);
        });
    }
    
    resetSettings() {
        this.settings = {
            roomSize: 10,
            reverbTime: 0.3,
            diffusion: 0.7,
            stereoWidth: 1.2,
            voiceThreshold: 0.3,
            neuralAdaptation: 0.8,
            binauralEnhancement: 0.6
        };
        
        this.updateUIFromSettings();
        this.updateSpatialProcessor();
        
        // Réinitialiser les positions des participants
        document.querySelectorAll('.participant-position.occupied').forEach(element => {
            element.classList.remove('occupied');
        });
    }
    
    testSpatialAudio() {
        const testBtn = document.getElementById('testBtn');
        testBtn.textContent = '🔊 Test en cours...';
        testBtn.disabled = true;
        
        // Simulation d'un test audio spatial
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'TEST_SPATIAL_AUDIO'
                });
            }
        });
        
        setTimeout(() => {
            testBtn.textContent = 'Test Audio';
            testBtn.disabled = false;
        }, 3000);
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

// Initialiser les paramètres spatiaux
document.addEventListener('DOMContentLoaded', () => {
    new SpatialAudioSettings();
});