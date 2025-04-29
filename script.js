// --- START OF FILE script.js ---

// Game Constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const LANE_COUNT = 3;
const LANE_WIDTH = CANVAS_WIDTH / LANE_COUNT;
const BLOCK_SIZE = 55;
const BLOCK_CORNER_RADIUS = 8;
const BIN_HEIGHT = 25;
const COLORS = { // Use object for easier reference and key mapping
    '1': '#e74c3c', // Red (Key 1)
    '2': '#2ecc71', // Green (Key 2)
    '3': '#3498db'  // Blue (Key 3)
};
const COLOR_KEYS = Object.keys(COLORS);
const COLOR_VALUES = Object.values(COLORS);

const INITIAL_SPEED = 2.5;
const SPEED_INCREASE_INTERVAL = 8000; // ms
const SPEED_INCREASE_AMOUNT = 0.3;
const INITIAL_SPAWN_INTERVAL = 1800; // ms
const MIN_SPAWN_INTERVAL = 400; // ms
const SPAWN_INTERVAL_DECREASE = 75; // ms

// --- Fever Mode Constants ---
const FEVER_MODE_COMBO_THRESHOLD = 10; // Combo multiplier needed to activate
const FEVER_MODE_DURATION_FRAMES = 300; // Duration in frames (e.g., 5 seconds at 60fps)
const FEVER_MODE_SCORE_MULTIPLIER = 2.5; // Score multiplier during fever mode (applied before combo)
const FEVER_MODE_BG_COLOR = '#ffdd44'; // Background color during fever mode
const FEVER_MODE_BIN_FLASH_SPEED = 5; // How fast bins flash during fever mode (lower is faster)

// --- Special Block Constants ---
const SPECIAL_BLOCK_SPAWN_CHANCE = 0.05; // 5% chance per spawn attempt
const SPECIAL_BLOCK_COLOR_1 = '#FFD700'; // Gold
const SPECIAL_BLOCK_COLOR_2 = '#FFFFFF'; // White (for pulsing/shimmering)
const SPECIAL_BLOCK_OUTLINE = '#FFFFFF'; // Outline color for special block

// --- Power-up Constants ---
const POWERUP_DURATION_FRAMES = 300; // 5 seconds at 60fps for temporary power-ups
const SLOW_MOTION_FACTOR = 0.5; // Game speed multiplier during slow-mo
const SCORE_MULTIPLIER_VALUE = 2; // Temporary score multiplier value

// --- UI Feedback Constants ---
const FEEDBACK_TEXT_DURATION = 90; // Frames (1.5 seconds) to show feedback text

// --- Special Block Rewards Table ---
const SPECIAL_REWARDS = [
    { id: 'cp_small', type: 'CP', value: 50, weight: 10, message: "+50 CP!" },
    { id: 'cp_medium', type: 'CP', value: 150, weight: 5, message: "+150 CP!" },
    { id: 'cp_large', type: 'CP', value: 300, weight: 2, message: "+300 CP!" },
    { id: 'powerup_slowmo', type: 'POWERUP', effect: 'slowmo', duration: POWERUP_DURATION_FRAMES, weight: 4, message: "Slow Motion!" },
    { id: 'powerup_invincible', type: 'POWERUP', effect: 'invincible', duration: POWERUP_DURATION_FRAMES, weight: 3, message: "Invincible!" },
    { id: 'powerup_score_multi', type: 'POWERUP', effect: 'score_multi', duration: POWERUP_DURATION_FRAMES, value: SCORE_MULTIPLIER_VALUE, weight: 4, message: "Score x2!" },
];

// --- Special Block / Power-up State ---
let consecutiveMisses = 0;
let activePowerUp = null;
let powerUpTimer = 0;
let originalGameSpeed = INITIAL_SPEED;
let temporaryScoreMultiplier = 1;

// --- UI Feedback State ---
let feedbackText = '';
let feedbackTextTimer = 0;

// --- Cascade Progression System ---
const PERKS = [
    { id: 'scoreBoost1', name: 'Score Boost I', description: '+10% base score per block.', cost: 100, tier: 1, prerequisites: [] },
    { id: 'startLife1', name: 'Starting Life I', description: 'Start with 4 lives.', cost: 250, tier: 1, prerequisites: [] },
    { id: 'comboExtender1', name: 'Combo Extender I', description: 'Combo resets after 2 misses instead of 1.', cost: 150, tier: 1, prerequisites: [] },
    { id: 'feverStarter1', name: 'Fever Starter I', description: 'Fever Mode activates at x9 combo.', cost: 300, tier: 1, prerequisites: [] },
    { id: 'scoreBoost2', name: 'Score Boost II', description: '+20% base score per block (total).', cost: 400, tier: 2, prerequisites: ['scoreBoost1'] },
    { id: 'feverDuration1', name: 'Fever Duration I', description: 'Fever Mode lasts 1 second longer (60 frames).', cost: 500, tier: 2, prerequisites: [] },
    { id: 'comboShield1', name: 'Combo Shield', description: 'First miss after x5 combo doesn\'t reset counter (once per game).', cost: 600, tier: 2, prerequisites: ['comboExtender1'] },
    { id: 'secondWind1', name: 'Second Wind', description: 'First time hitting 0 lives, regain 1 life (once per game).', cost: 1000, tier: 3, prerequisites: ['startLife1'] },
];

// Progression State
let cascadePoints = 0;
let unlockedPerkIDs = [];
let highestComboThisGame = 0;
let feverActivationsThisGame = 0;
let highScores = [];
const HIGH_SCORE_LIMIT = 10;

// Perk Status Variables (Reset each game)
let missesBeforeComboReset = 1;
let comboShieldAvailable = true;
let secondWindAvailable = true;

// Game State
let canvas, ctx;
let score = 0;
let lives = 3;
let currentBinColor = COLOR_VALUES[0];
let currentBinKey = COLOR_KEYS[0];
let fallingBlocks = [];
let gameSpeed = INITIAL_SPEED;
let spawnInterval = INITIAL_SPAWN_INTERVAL;
let lastSpawnTime = 0;
let lastSpeedIncreaseTime = 0;
let isGameOver = false;
let animationId = null;
let comboCounter = 0;
let comboMultiplier = 1;
let binFlashTimer = 0;
let shakeTimer = 0;
let isPaused = false;
let pauseStartTime = 0;

// --- Fever Mode State ---
let isFeverMode = false;
let feverModeTimer = 0;
let feverBinFlashCounter = 0;

// DOM Elements
let scoreElement, livesElement, comboElement, startButton, gameOverElement, finalScoreElement, restartButton, canvasContainer;
let pauseButton, pauseOverlay;
let highScoreListElement;

// Audio Elements (get references)
let audioBGM, audioBGMFever, audioFeverStart, audioFeverEnd, audioFeverCatch;

// Audio Context and Oscillators (for generated sounds)
let audioContext;
let catchSound, missSound, changeSound, gameOverSound, startSound;
let isAudioEnabled = false;

// --- Perk Shop UI ---
let perkShopElement, cpDisplayElement, perkListElement, openPerkShopButton, closePerkShopButton;

// --- Save/Load Progress ---
function saveProgress() {
    try {
        localStorage.setItem('cascadePoints', cascadePoints.toString());
        localStorage.setItem('unlockedPerks', JSON.stringify(unlockedPerkIDs));
        console.log("Progress Saved:", { cascadePoints, unlockedPerkIDs });
    } catch (e) {
        console.error("Failed to save progress:", e);
    }
}

function loadProgress() {
    try {
        const savedPoints = localStorage.getItem('cascadePoints');
        const savedPerks = localStorage.getItem('unlockedPerks');

        cascadePoints = parseInt(savedPoints, 10) || 0;
        unlockedPerkIDs = savedPerks ? JSON.parse(savedPerks) : [];

        console.log("Progress Loaded:", { cascadePoints, unlockedPerkIDs });

        applyPerkEffects(); // Apply effects of loaded perks
        updatePerkShopUI(); // Update shop based on loaded perks/CP

    } catch (e) {
        console.error("Failed to load progress:", e);
        cascadePoints = 0;
        unlockedPerkIDs = [];
    }
    loadHighScores(); // Load high scores after other progress
}

// --- High Score Management ---
function loadHighScores() {
    try {
        const savedScores = localStorage.getItem('highScores');
        highScores = savedScores ? JSON.parse(savedScores) : [];
        highScores.sort((a, b) => b.score - a.score); // Ensure sorted
        console.log("High Scores Loaded:", highScores);
        updateHighScoreDisplay(); // Display immediately after loading
    } catch (e) {
        console.error("Failed to load high scores:", e);
        highScores = [];
    }
}

function saveHighScores() {
    try {
        highScores.sort((a, b) => b.score - a.score);
        highScores = highScores.slice(0, HIGH_SCORE_LIMIT);
        localStorage.setItem('highScores', JSON.stringify(highScores));
        console.log("High Scores Saved:", highScores);
    } catch (e) {
        console.error("Failed to save high scores:", e);
    }
}

function addHighScore(newScore) {
    const scoreEntry = {
        score: newScore,
        date: new Date().toLocaleDateString()
    };
    highScores.push(scoreEntry);
    saveHighScores(); // Sorts, limits, and saves
    updateHighScoreDisplay(); // Update the list visible on game over screen
}

function updateHighScoreDisplay() {
    if (!highScoreListElement) {
        console.warn("High score list element not found yet.");
        return;
    }
    highScoreListElement.innerHTML = ''; // Clear previous list

    if (highScores.length === 0) {
        highScoreListElement.innerHTML = '<li>No scores yet!</li>';
        return;
    }

    highScores.forEach((entry) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${entry.score} pts</span> <span>${entry.date}</span>`;
        highScoreListElement.appendChild(li);
    });
}

// Helper to apply loaded perks initially and at game start
function applyPerkEffects() {
    // Reset per-game perk states
    comboShieldAvailable = true;
    secondWindAvailable = true;
    missesBeforeComboReset = 1; // Default

    // Apply persistent effects from perks
    if (unlockedPerkIDs.includes('comboExtender1')) {
        missesBeforeComboReset = 2;
    }
    // Add other perk applications here as needed for game setup
}


// --- Block Class ---
class Block {
    constructor(lane, color) {
        this.x = lane * LANE_WIDTH + (LANE_WIDTH - BLOCK_SIZE) / 2;
        this.y = -BLOCK_SIZE;
        this.width = BLOCK_SIZE;
        this.height = BLOCK_SIZE;
        this.color = color;
        this.lane = lane;
        this.opacity = 1;
    }

    move(speed) {
        this.y += speed;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.moveTo(this.x + BLOCK_CORNER_RADIUS, this.y);
        ctx.lineTo(this.x + this.width - BLOCK_CORNER_RADIUS, this.y);
        ctx.quadraticCurveTo(this.x + this.width, this.y, this.x + this.width, this.y + BLOCK_CORNER_RADIUS);
        ctx.lineTo(this.x + this.width, this.y + this.height - BLOCK_CORNER_RADIUS);
        ctx.quadraticCurveTo(this.x + this.width, this.y + this.height, this.x + this.width - BLOCK_CORNER_RADIUS, this.y + this.height);
        ctx.lineTo(this.x + BLOCK_CORNER_RADIUS, this.y + this.height);
        ctx.quadraticCurveTo(this.x, this.y + this.height, this.x, this.y + this.height - BLOCK_CORNER_RADIUS);
        ctx.lineTo(this.x, this.y + BLOCK_CORNER_RADIUS);
        ctx.quadraticCurveTo(this.x, this.y, this.x + BLOCK_CORNER_RADIUS, this.y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// --- Special Block Class ---
class SpecialBlock extends Block {
    constructor(lane) {
        super(lane, SPECIAL_BLOCK_COLOR_1);
        this.isSpecial = true;
        this.pulseCounter = Math.random() * 100;
    }

    draw() {
        this.pulseCounter += 0.1;
        const pulse = Math.sin(this.pulseCounter) * 0.5 + 0.5;
        const dynamicColor = lerpColor(SPECIAL_BLOCK_COLOR_1, SPECIAL_BLOCK_COLOR_2, pulse);

        ctx.fillStyle = dynamicColor;
        ctx.strokeStyle = SPECIAL_BLOCK_OUTLINE;
        ctx.lineWidth = 2;
        ctx.globalAlpha = this.opacity;

        ctx.beginPath();
        ctx.moveTo(this.x + BLOCK_CORNER_RADIUS, this.y);
        ctx.lineTo(this.x + this.width - BLOCK_CORNER_RADIUS, this.y);
        ctx.quadraticCurveTo(this.x + this.width, this.y, this.x + this.width, this.y + BLOCK_CORNER_RADIUS);
        ctx.lineTo(this.x + this.width, this.y + this.height - BLOCK_CORNER_RADIUS);
        ctx.quadraticCurveTo(this.x + this.width, this.y + this.height, this.x + this.width - BLOCK_CORNER_RADIUS, this.y + this.height);
        ctx.lineTo(this.x + BLOCK_CORNER_RADIUS, this.y + this.height);
        ctx.quadraticCurveTo(this.x, this.y + this.height, this.x, this.y + this.height - BLOCK_CORNER_RADIUS);
        ctx.lineTo(this.x, this.y + BLOCK_CORNER_RADIUS);
        ctx.quadraticCurveTo(this.x, this.y, this.x + BLOCK_CORNER_RADIUS, this.y);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
    }
}

// --- Sound Initialization and Management ---
function initializeSounds() {
    // Get references to HTML audio elements
    audioBGM = document.getElementById('audioBGM');
    audioBGMFever = document.getElementById('audioBGMFever');
    audioFeverStart = document.getElementById('audioFeverStart');
    audioFeverEnd = document.getElementById('audioFeverEnd');
    audioFeverCatch = document.getElementById('audioFeverCatch');

    // Check if elements exist
    if (!audioBGM || !audioBGMFever || !audioFeverStart || !audioFeverEnd || !audioFeverCatch) {
        console.warn("One or more HTML audio elements not found. File-based sounds might not work.");
    }

    // Initialize generated sounds via AudioContext
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        function createSound(frequency, duration, type = 'sine') {
            return function() {
                if (!isAudioEnabled || !audioContext) return;
                try {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    oscillator.type = type;
                    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + duration);
                } catch (e) {
                    console.error("Error playing generated sound:", e);
                }
            };
        }

        catchSound = createSound(880, 0.1, 'sine');
        missSound = createSound(220, 0.2, 'square');
        changeSound = createSound(440, 0.1, 'triangle');
        gameOverSound = createSound(110, 0.5, 'sawtooth');
        startSound = createSound(660, 0.2, 'sine');

        // Enable audio on first user interaction (important for browsers)
        const enableAudioInteraction = () => {
            if (!isAudioEnabled && audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    isAudioEnabled = true;
                    console.log("AudioContext resumed.");
                    // Optional: play a silent sound or a tiny blip to ensure it's working
                    // startSound(); // Or play a dedicated init sound
                    // Remove the listener after the first successful interaction
                    document.removeEventListener('click', enableAudioInteraction);
                    document.removeEventListener('keydown', enableAudioInteraction);
                }).catch(e => console.error("AudioContext resume failed:", e));
            } else if (audioContext && audioContext.state === 'running') {
                 isAudioEnabled = true; // Already running
                 document.removeEventListener('click', enableAudioInteraction);
                 document.removeEventListener('keydown', enableAudioInteraction);
            }
        };
        document.addEventListener('click', enableAudioInteraction, { once: false }); // Keep listening until success
        document.addEventListener('keydown', enableAudioInteraction, { once: false });


    } catch (error) {
        console.error("AudioContext initialization failed:", error);
        // Fallback or disable audio features if needed
    }
}

// --- Helper Function to Play Sound (Generated or File) ---
function playSound(sound) {
    if (!isAudioEnabled) return;

    if (typeof sound === 'function') {
        // It's a generated sound function
        try {
            sound();
        } catch (error) {
            console.error("Generated sound playback failed:", error);
        }
    } else if (sound && typeof sound.play === 'function') {
        // It's an HTMLAudioElement
        sound.currentTime = 0; // Rewind first
        sound.play().catch(error => {
            // Autoplay restrictions might cause errors if not triggered by user interaction
            if (error.name !== 'NotAllowedError') {
                console.error("HTML Audio playback failed:", error);
            }
        });
    }
}

// --- BGM Management ---
function playBGM(fever = false) {
    if (isPaused || isGameOver || !isAudioEnabled) return;

    const targetBGM = fever ? audioBGMFever : audioBGM;
    const otherBGM = fever ? audioBGM : audioBGMFever;

    if (otherBGM && !otherBGM.paused) {
        otherBGM.pause();
    }
    if (targetBGM) {
        targetBGM.currentTime = 0;
        targetBGM.play().catch(e => console.warn(`${fever ? 'Fever ' : ''}BGM play failed:`, e));
    }
}

function pauseBGM() {
    if (audioBGM && !audioBGM.paused) audioBGM.pause();
    if (audioBGMFever && !audioBGMFever.paused) audioBGMFever.pause();
}

function resumeBGM() {
    if (isPaused || isGameOver || !isAudioEnabled) return;
    const targetBGM = isFeverMode ? audioBGMFever : audioBGM;
    if (targetBGM && targetBGM.paused) {
        targetBGM.play().catch(e => console.warn(`${isFeverMode ? 'Fever ' : ''}BGM resume failed:`, e));
    }
}

function stopBGM() {
    if (audioBGM) { audioBGM.pause(); audioBGM.currentTime = 0; }
    if (audioBGMFever) { audioBGMFever.pause(); audioBGMFever.currentTime = 0; }
}

// --- Initialization ---
function init() {
    // Get Canvas and Context
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Get DOM Elements
    scoreElement = document.getElementById('score');
    livesElement = document.getElementById('lives');
    comboElement = document.getElementById('combo');
    startButton = document.getElementById('startButton');
    gameOverElement = document.getElementById('gameOver');
    finalScoreElement = document.getElementById('finalScore');
    restartButton = document.getElementById('restartButton');
    canvasContainer = document.getElementById('canvas-container');
    pauseButton = document.getElementById('pauseButton');
    pauseOverlay = document.getElementById('pauseOverlay');
    highScoreListElement = document.getElementById('highScoreList');
    perkShopElement = document.getElementById('perkShop');
    cpDisplayElement = document.getElementById('cpDisplay');
    perkListElement = document.getElementById('perkList');
    openPerkShopButton = document.getElementById('openPerkShopButton');
    closePerkShopButton = document.getElementById('closePerkShopButton');

    // Check if all essential elements were found
    if (!canvas || !ctx || !scoreElement || !livesElement || !comboElement || !startButton || !gameOverElement || !finalScoreElement || !restartButton || !canvasContainer || !pauseButton || !pauseOverlay || !highScoreListElement || !perkShopElement || !cpDisplayElement || !perkListElement || !openPerkShopButton || !closePerkShopButton) {
        console.error("FATAL: One or more required DOM elements not found! Aborting initialization.");
        alert("Error: Could not initialize game elements. Please check the console (F12).");
        return; // Stop execution if critical elements are missing
    }

    initializeSounds(); // Initialize sounds

    // Event Listeners
    document.addEventListener('keydown', handleKeyPress);
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    pauseButton.addEventListener('click', togglePause);

    openPerkShopButton.addEventListener('click', () => {
        console.log(`Opening perk shop. Current state: isPaused=${isPaused}, isGameOver=${isGameOver}, animationId=${animationId}`);
        // Check if the game is running and not already paused before pausing it
        const gameIsRunning = !isGameOver && startButton.classList.contains('hidden') && animationId !== null;
        if (gameIsRunning && !isPaused) {
            console.log("Pausing game to open perk shop");
            togglePause(); // This will handle pausing and syncing the overlay
        }
        perkShopElement.classList.remove('hidden');
        updatePerkShopUI();
        // No need to call syncPauseOverlay here, togglePause handles it if needed
    });

    closePerkShopButton.addEventListener('click', () => {
        console.log(`Closing perk shop.`);
        perkShopElement.classList.add('hidden');
        // No need to call syncPauseOverlay here unless closing the shop should unpause
        // If closing the shop should *always* unpause, call togglePause() if isPaused is true.
    });

    // Initial UI State Setup
    isPaused = false;
    isGameOver = true; // Start in "game over" state until game starts
    animationId = null;

    // Initial UI Setup
    updateUI(); // Set initial score/lives display
    startButton.classList.remove('hidden');
    gameOverElement.classList.add('hidden');
    comboElement.classList.add('hidden');
    perkShopElement.classList.add('hidden');
    pauseButton.disabled = true;

    loadProgress(); // Load CP, Perks, and High Scores

    // *** CRITICAL: Ensure overlay is correctly hidden after all initial setup ***
    syncPauseOverlay();
    console.log("Init complete. Final overlay sync.");
}

// --- Sync Pause Overlay Visibility ---
// *** THIS IS NOW THE SINGLE SOURCE OF TRUTH FOR THE OVERLAY ***
function syncPauseOverlay() {
    // Determine if the game is in a state where pausing is possible/relevant
    // Game must not be over AND the start button must be hidden (meaning game has started)
    const gameIsActiveAndPausable = !isGameOver && startButton.classList.contains('hidden');

    if (isPaused && gameIsActiveAndPausable) {
        // Show overlay ONLY if paused AND the game is actually running
        pauseOverlay.classList.remove('hidden');
        console.log("Sync: Overlay SHOWN (Paused & Active)");
    } else {
        // Hide overlay in all other cases (not paused, game over, pre-start)
        pauseOverlay.classList.add('hidden');
        console.log(`Sync: Overlay HIDDEN (Paused: ${isPaused}, Active/Pausable: ${gameIsActiveAndPausable})`);
    }
}

// --- Pause/Resume Logic ---
function togglePause() {
    // Prevent pausing if game isn't in a pausable state
    const gameIsRunning = !isGameOver && startButton.classList.contains('hidden');
    if (!gameIsRunning) {
        console.log("Cannot pause: Game is not running.");
        return;
    }

    isPaused = !isPaused;
    console.log(`Toggling pause. New state: isPaused=${isPaused}`);

    if (isPaused) {
        pauseStartTime = Date.now();
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
            console.log("Animation frame cancelled for pause.");
        }
        pauseButton.textContent = 'Resume';
        pauseBGM();
        console.log("Game Paused");
    } else {
        const pauseDuration = Date.now() - pauseStartTime;
        lastSpawnTime += pauseDuration;
        lastSpeedIncreaseTime += pauseDuration;
        // Add pause duration to any other Date.now() based timers if needed

        pauseButton.textContent = 'Pause';
        resumeBGM();
        console.log("Game Resumed");
        if (!animationId) { // Restart loop only if it was stopped by pause
            console.log("Restarting game loop after resume.");
            gameLoop();
        }
    }
    // *** Centralized visibility control ***
    syncPauseOverlay();
}

// --- Input Handling ---
function handleKeyPress(event) {
    // Pause/Resume with 'P' key
    if (event.key === 'p' || event.key === 'P') {
         togglePause(); // togglePause now handles sync
         return;
     }

    // Prevent actions if paused, game over, or shop is open
    // Check !isPaused first as it's the most common active block
    if (isPaused || isGameOver || !perkShopElement.classList.contains('hidden')) return;

    // Color change logic - prevent during Fever Mode
    if (isFeverMode) return;

    const key = event.key;
    if (COLORS[key]) {
        if (key !== currentBinKey) {
             currentBinColor = COLORS[key];
             currentBinKey = key;
             binFlashTimer = 10;
             playSound(changeSound);
        }
    }
}

// --- Block Spawning ---
function spawnBlock() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    if (Math.random() < SPECIAL_BLOCK_SPAWN_CHANCE) {
        fallingBlocks.push(new SpecialBlock(lane));
    } else {
        const colorIndex = Math.floor(Math.random() * COLOR_VALUES.length);
        fallingBlocks.push(new Block(lane, COLOR_VALUES[colorIndex]));
    }
}

// --- Activate Fever Mode ---
function activateFeverMode() {
    if (isFeverMode) return;
    isFeverMode = true;
    const bonusDuration = unlockedPerkIDs.includes('feverDuration1') ? 60 : 0;
    feverModeTimer = FEVER_MODE_DURATION_FRAMES + bonusDuration;
    feverBinFlashCounter = 0;
    playSound(audioFeverStart); // Play file sound
    playBGM(true);
    feverActivationsThisGame++;
    console.log(`FEVER MODE ACTIVATED! Duration: ${feverModeTimer} frames`);
}

// --- Deactivate Fever Mode ---
function deactivateFeverMode() {
    if (!isFeverMode) return;
    isFeverMode = false;
    feverModeTimer = 0;
    playSound(audioFeverEnd); // Play file sound
    playBGM(false);
    console.log("FEVER MODE ENDED.");
}


// --- Update Game State ---
function update() {
    // isPaused is handled by gameLoop start/stop
    if (isGameOver) return;

    const currentTime = Date.now();

    // Update Power-up Timer
    if (activePowerUp && powerUpTimer > 0) {
        powerUpTimer--;
        if (powerUpTimer <= 0) deactivateCurrentPowerUp();
    }

    // Update Feedback Text Timer
    if (feedbackTextTimer > 0) {
        feedbackTextTimer--;
        if (feedbackTextTimer <= 0) feedbackText = '';
    }

    // Track highest combo
    if (comboMultiplier > highestComboThisGame) highestComboThisGame = comboMultiplier;

    // Fever Mode Timer Update
    if (isFeverMode) {
        feverModeTimer--;
        feverBinFlashCounter++;
        if (feverModeTimer <= 0) deactivateFeverMode();
    }

    // Determine speed (consider slow-mo)
    const currentFrameSpeed = activePowerUp === 'slowmo' ? gameSpeed * SLOW_MOTION_FACTOR : gameSpeed;

    // Move blocks
    fallingBlocks.forEach(block => block.move(currentFrameSpeed));

    // Check collisions / bottom reached
    let blocksToRemoveIndices = [];
    fallingBlocks.forEach((block, index) => {
        if (block.y + block.height >= CANVAS_HEIGHT - BIN_HEIGHT) { // Block at bin
            let caught = false;
            let scoreIncrease = 0;
            const basePoints = unlockedPerkIDs.includes('scoreBoost2') ? 12 : (unlockedPerkIDs.includes('scoreBoost1') ? 11 : 10);

            if (block.isSpecial) {
                caught = true;
                applyReward(getRandomReward());
                playSound(catchSound); // Use generated sound
                consecutiveMisses = 0;
            } else { // Normal/Fever Block
                if (isFeverMode) {
                    caught = true;
                    const feverScoreMultiplier = unlockedPerkIDs.includes('feverPower1') ? (FEVER_MODE_SCORE_MULTIPLIER + 0.5) : FEVER_MODE_SCORE_MULTIPLIER;
                    scoreIncrease = Math.floor(basePoints * feverScoreMultiplier * temporaryScoreMultiplier) * comboMultiplier;
                    playSound(audioFeverCatch); // Use file sound
                    consecutiveMisses = 0;
                    // Apply Life Chance Perk... (removed for brevity, assume it's here if needed)
                } else { // Normal Mode
                    if (block.color === currentBinColor) { // Catch
                        caught = true;
                        scoreIncrease = basePoints * comboMultiplier * temporaryScoreMultiplier;
                        playSound(catchSound); // Use generated sound
                        consecutiveMisses = 0;
                    } else { // Miss
                        if (activePowerUp === 'invincible') {
                            playSound(missSound); // Use generated sound
                            triggerScreenShake(5);
                        } else {
                            consecutiveMisses++;
                            playSound(missSound); // Use generated sound
                            triggerScreenShake(5);
                        }
                    }
                }
            }

            if (caught && !block.isSpecial) {
                score += scoreIncrease;
                comboCounter++;
                const blocksPerMultiplier = unlockedPerkIDs.includes('comboMaster1') ? 4 : 5;
                comboMultiplier = 1 + Math.floor(comboCounter / blocksPerMultiplier);
                if (comboMultiplier > highestComboThisGame) highestComboThisGame = comboMultiplier;

                const feverThreshold = unlockedPerkIDs.includes('feverStarter1') ? 9 : FEVER_MODE_COMBO_THRESHOLD;
                if (!isFeverMode && comboMultiplier >= feverThreshold) activateFeverMode();
            }
            blocksToRemoveIndices.push(index);

        } else if (block.y > CANVAS_HEIGHT) { // Block missed canvas
            blocksToRemoveIndices.push(index);
            if (!isFeverMode && activePowerUp !== 'invincible') {
                consecutiveMisses++;
                playSound(missSound); // Use generated sound
                triggerScreenShake(5);
            } else if (activePowerUp === 'invincible') {
                playSound(missSound); // Use generated sound
            }
        }
    });

    // Handle Miss Penalties (Corrected Logic)
    if (consecutiveMisses > 0 && activePowerUp !== 'invincible') {
        let comboBroken = true;
        let lifeLostThisTurn = false;

        if (unlockedPerkIDs.includes('comboShield1') && comboCounter >= 5 && comboShieldAvailable) {
            comboBroken = false;
            comboShieldAvailable = false;
            triggerScreenShake(5);
            consecutiveMisses = 0; // Shield absorbs miss sequence
        } else if (consecutiveMisses < missesBeforeComboReset) {
            comboBroken = false; // Extender prevents combo break for now
        }

        if (comboBroken) {
            if (comboCounter > 0) {
                comboCounter = 0;
                comboMultiplier = 1;
            }
            lifeLostThisTurn = true; // Mark for life loss
        }

        if (lifeLostThisTurn) {
            const canUseSecondWind = unlockedPerkIDs.includes('secondWind1') && secondWindAvailable && lives === 1;
            if (!canUseSecondWind) {
                lives--;
                playSound(missSound); // Use generated sound
                triggerScreenShake(15);
                if (lives <= 0) {
                    lives = 0;
                    gameOver();
                    return; // Exit update
                }
            } else { // Second Wind
                lives = 1;
                secondWindAvailable = false;
                playSound(missSound); // Use generated sound
                triggerScreenShake(25);
            }
            consecutiveMisses = 0; // Reset after penalty applied
        }
        updateUI(); // Update UI after potential changes
    }

    // Remove processed blocks
    for (let i = blocksToRemoveIndices.length - 1; i >= 0; i--) {
        fallingBlocks.splice(blocksToRemoveIndices[i], 1);
    }

    // Spawn new blocks
    if (currentTime - lastSpawnTime > spawnInterval) {
        spawnBlock();
        lastSpawnTime = currentTime;
    }

    // Increase difficulty
    if (!isFeverMode && activePowerUp !== 'slowmo' && currentTime - lastSpeedIncreaseTime > SPEED_INCREASE_INTERVAL) {
        gameSpeed += SPEED_INCREASE_AMOUNT;
        originalGameSpeed = gameSpeed;
        spawnInterval = Math.max(MIN_SPAWN_INTERVAL, spawnInterval - SPAWN_INTERVAL_DECREASE);
        lastSpeedIncreaseTime = currentTime;
    } else if (activePowerUp === 'slowmo' && currentTime - lastSpeedIncreaseTime > SPEED_INCREASE_INTERVAL) {
        originalGameSpeed += SPEED_INCREASE_AMOUNT; // Increase base speed
        // gameSpeed is handled dynamically based on originalGameSpeed * factor
        spawnInterval = Math.max(MIN_SPAWN_INTERVAL, spawnInterval - SPAWN_INTERVAL_DECREASE);
        lastSpeedIncreaseTime = currentTime;
    }

    // Update UI display
    updateUI();

    // Update visual effect timers
    if (binFlashTimer > 0) binFlashTimer--;
    if (shakeTimer > 0) shakeTimer--;
}

// --- Update UI Elements ---
function updateUI() {
    if (scoreElement) scoreElement.textContent = `Score: ${score}`;
    if (livesElement) livesElement.textContent = `Lives: ${lives}`;
    if (comboElement) {
        if (comboMultiplier > 1) {
            comboElement.textContent = `Combo: x${comboMultiplier}`;
            comboElement.classList.remove('hidden');
        } else {
            comboElement.classList.add('hidden');
        }
    }
    // REMOVED: syncPauseOverlay(); // Called too frequently here. Call only on state change.
}

// --- Drawing ---
function draw() {
    // Screen shake
    if (shakeTimer > 0 && !isPaused) {
        canvasContainer.classList.add('shake');
    } else {
        canvasContainer.classList.remove('shake');
    }

    // Clear canvas
    ctx.fillStyle = isFeverMode ? FEVER_MODE_BG_COLOR : '#2c3e50'; // Changed back to original dark blue-grey
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Bins
    let binDrawColor = currentBinColor;
    if (isFeverMode) {
        const flashCycle = Math.floor(feverBinFlashCounter / FEVER_MODE_BIN_FLASH_SPEED) % 2;
        binDrawColor = flashCycle === 0 ? '#FFFFFF' : lerpColor(currentBinColor, '#FFFFFF', 0.5);
    } else if (binFlashTimer > 0) {
        const flashAmount = 0.6 * Math.sin(((10 - binFlashTimer) / 10) * Math.PI / 2);
        binDrawColor = lerpColor(currentBinColor, "#FFFFFF", flashAmount);
    }
    for (let i = 0; i < LANE_COUNT; i++) {
        const gradient = ctx.createLinearGradient(i * LANE_WIDTH, CANVAS_HEIGHT - BIN_HEIGHT, i * LANE_WIDTH, CANVAS_HEIGHT);
        gradient.addColorStop(0, binDrawColor);
        gradient.addColorStop(1, darkenColor(binDrawColor, 0.3));
        ctx.fillStyle = gradient;
        ctx.fillRect(i * LANE_WIDTH, CANVAS_HEIGHT - BIN_HEIGHT, LANE_WIDTH, BIN_HEIGHT);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(i * LANE_WIDTH, CANVAS_HEIGHT - BIN_HEIGHT, LANE_WIDTH, 1);
    }

    // Draw Blocks
    fallingBlocks.forEach(block => block.draw());

    // Draw Fever Mode Indicator
    if (isFeverMode) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.font = 'bold 48px Poppins';
        ctx.textAlign = 'center';
        ctx.fillText('FEVER MODE!', CANVAS_WIDTH / 2, 60);
        // Timer Bar... (code omitted for brevity, assume it's here if needed)
    }

    // Draw Power-up Status / Timer
    if (activePowerUp) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 24px Poppins';
        ctx.textAlign = 'left';
        let powerUpText = activePowerUp.toUpperCase().replace('_', ' ');
        if (activePowerUp === 'score_multi') powerUpText += ` (x${temporaryScoreMultiplier})`;
        ctx.fillText(`POWERUP: ${powerUpText}`, 20, CANVAS_HEIGHT - 40);
        // Timer Bar... (code omitted for brevity, assume it's here if needed)
    }

    // Draw Feedback Text
    if (feedbackTextTimer > 0 && feedbackText) {
        const fadeStartRatio = 0.5;
        const currentRatio = feedbackTextTimer / FEEDBACK_TEXT_DURATION;
        let alpha = (currentRatio < fadeStartRatio) ? (currentRatio / fadeStartRatio) : 1.0;
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.font = 'bold 36px Poppins';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 5;
        ctx.fillText(feedbackText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.shadowBlur = 0;
    }
}

// --- Game Loop ---
function gameLoop() {
    // The checks for isPaused and isGameOver are implicitly handled by
    // togglePause and gameOver cancelling the animation frame.
    // If the loop is running, we know we are not paused and not game over.

    update();
    draw();

    // Request the next frame *only if* the game hasn't been stopped
    // (e.g., by pausing or game over between update/draw and here)
    if (!isPaused && !isGameOver) {
        animationId = requestAnimationFrame(gameLoop);
    } else {
        console.log(`Game loop terminating. isPaused: ${isPaused}, isGameOver: ${isGameOver}`);
        animationId = null; // Ensure ID is cleared if loop stops unexpectedly
    }
}

// --- Start Game ---
function startGame() {
    console.log("Starting new game...");
    // Reset Progression Trackers
    highestComboThisGame = 0;
    feverActivationsThisGame = 0;

    // Apply Perks
    applyPerkEffects();
    lives = unlockedPerkIDs.includes('startLife1') ? 4 : 3;

    // Reset Core Game State
    score = 0;
    gameSpeed = INITIAL_SPEED;
    originalGameSpeed = gameSpeed; // Reset original speed as well
    spawnInterval = INITIAL_SPAWN_INTERVAL;
    fallingBlocks = [];
    isGameOver = false;
    isPaused = false; // Ensure not paused on start
    comboCounter = 0;
    comboMultiplier = 1;
    binFlashTimer = 0;
    shakeTimer = 0;

    // Reset Special Block / Power-up State
    consecutiveMisses = 0;
    activePowerUp = null;
    powerUpTimer = 0;
    temporaryScoreMultiplier = 1;
    feedbackText = '';
    feedbackTextTimer = 0;

    // Reset Fever Mode State
    isFeverMode = false;
    feverModeTimer = 0;
    feverBinFlashCounter = 0;

    // Reset Timers
    lastSpawnTime = Date.now();
    lastSpeedIncreaseTime = Date.now();
    pauseStartTime = 0;

    // UI Updates
    startButton.classList.add('hidden'); // State change!
    gameOverElement.classList.add('hidden');
    perkShopElement.classList.add('hidden');
    pauseButton.disabled = false;
    pauseButton.textContent = 'Pause';
    updateUI(); // Update score/lives display

    // Audio
    playSound(startSound);
    stopBGM();
    playBGM(false);

    // Start Game Loop
    if (animationId) cancelAnimationFrame(animationId);
    console.log("Requesting initial animation frame for game loop.");
    animationId = requestAnimationFrame(gameLoop); // Assign ID immediately

    // *** CRITICAL: Sync overlay AFTER state changes and loop is requested ***
    syncPauseOverlay();
    console.log("StartGame complete. Overlay state synced.");
}

// --- Game Over ---
function gameOver() {
    if (isGameOver) return; // Prevent multiple executions
    console.log("Game Over sequence started.");
    isGameOver = true; // State change!
    isPaused = false; // Ensure not paused

    stopBGM();
    playSound(gameOverSound); // Play generated sound

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
        console.log("Animation frame cancelled for game over.");
    }

    // Calculate CP
    const baseCP = Math.floor(score / 100);
    const comboBonusCP = highestComboThisGame * 5;
    const feverBonusCP = feverActivationsThisGame * 20;
    let feverExitBonusCP = 0; // Placeholder for potential future perk
    const totalCPEarned = baseCP + comboBonusCP + feverBonusCP + feverExitBonusCP;
    cascadePoints += totalCPEarned;

    console.log(`Game Over. Score: ${score}, Highest Combo: x${highestComboThisGame}, Fever Activations: ${feverActivationsThisGame}`);
    console.log(`CP Earned: ${totalCPEarned}`);
    console.log(`Total CP: ${cascadePoints}`);

    saveProgress(); // Save CP and Perks
    addHighScore(score); // Add score, save high scores, and update display

    // Update UI
    finalScoreElement.textContent = score;
    gameOverElement.classList.remove('hidden');
    pauseButton.disabled = true; // Disable pause button
    updatePerkShopUI(); // Update shop CP display

    // Reset Visuals/State
    isFeverMode = false;
    canvasContainer.classList.remove('shake');
    activePowerUp = null;
    powerUpTimer = 0;
    temporaryScoreMultiplier = 1;
    feedbackText = '';
    feedbackTextTimer = 0;
    gameSpeed = INITIAL_SPEED; // Reset speed
    
    // *** CRITICAL: Sync overlay AFTER state changes ***
    syncPauseOverlay();
    console.log("GameOver complete. Overlay state synced.");
}

// --- Helper Functions ---
function triggerScreenShake(durationFrames) { shakeTimer = durationFrames; }
function lerpColor(a, b, amount) { /* ... implementation ... */ return '#ffffff'; } // Placeholder
function darkenColor(color, percent) { /* ... implementation ... */ return '#000000'; } // Placeholder
// --- (Add back the actual implementations for lerpColor and darkenColor from your previous code) ---
// Linear interpolation for hex colors (implementation needed)
function lerpColor(a, b, amount) {
    const ar = parseInt(a.slice(1, 3), 16),
          ag = parseInt(a.slice(3, 5), 16),
          ab = parseInt(a.slice(5, 7), 16),
          br = parseInt(b.slice(1, 3), 16),
          bg = parseInt(b.slice(3, 5), 16),
          bb = parseInt(b.slice(5, 7), 16),
          rr = Math.round(ar + amount * (br - ar)).toString(16).padStart(2, '0'),
          gg = Math.round(ag + amount * (bg - ag)).toString(16).padStart(2, '0'),
          bb_ = Math.round(ab + amount * (bb - ab)).toString(16).padStart(2, '0');
    return `#${rr}${gg}${bb_}`;
}

// Darken a hex color by a percentage (0-1) (implementation needed)
function darkenColor(color, percent) {
    const num = parseInt(color.slice(1), 16),
          amt = Math.round(2.55 * (percent * 100)),
          R = Math.max(0, (num >> 16) - amt),
          G = Math.max(0, (num >> 8 & 0x00FF) - amt),
          B = Math.max(0, (num & 0x0000FF) - amt);
    return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}


// --- Perk Shop UI ---
function updatePerkShopUI() {
    if (!perkListElement || !cpDisplayElement) return;

    cpDisplayElement.textContent = cascadePoints;
    perkListElement.innerHTML = '';

    PERKS.sort((a, b) => a.cost - b.cost).forEach(perk => {
        const isUnlocked = unlockedPerkIDs.includes(perk.id);
        const canAfford = cascadePoints >= perk.cost;
        const prereqsMet = perk.prerequisites.every(prereqId => unlockedPerkIDs.includes(prereqId));
        const canPurchase = !isUnlocked && canAfford && prereqsMet;

        const perkItem = document.createElement('div');
        perkItem.classList.add('perk-item');
        if (!isUnlocked && (!canAfford || !prereqsMet)) {
            perkItem.classList.add('disabled');
        }

        let buttonHtml = isUnlocked
            ? `<span class="unlocked-text">Unlocked</span>`
            : `<button class="purchase-perk-button" data-perk-id="${perk.id}" ${!canPurchase ? 'disabled' : ''}>Buy (${perk.cost} CP)</button>`;

        let prereqText = '';
        if (perk.prerequisites.length > 0) {
            const prereqNames = perk.prerequisites.map(id => PERKS.find(p => p.id === id)?.name || '?').join(', ');
            const style = !prereqsMet ? ' style="color: var(--error-color);"' : '';
            prereqText = `<br><small${style}>Requires: ${prereqNames}</small>`;
        }

        perkItem.innerHTML = `
            <div class="perk-details">
                <h3>${perk.name} (Tier ${perk.tier})</h3>
                <p>${perk.description}${prereqText}</p>
            </div>
            <div>
                 ${isUnlocked ? '' : `<span class="perk-cost">${perk.cost} CP</span>`}
                 ${buttonHtml}
            </div>
        `;
        perkListElement.appendChild(perkItem);
    });

    addPurchaseButtonListeners(); // Re-attach listeners
}

function handlePerkPurchase(event) {
    if (!event.target.classList.contains('purchase-perk-button')) return;

    const perkId = event.target.getAttribute('data-perk-id');
    const perk = PERKS.find(p => p.id === perkId);

    if (perk && !unlockedPerkIDs.includes(perkId) && cascadePoints >= perk.cost) {
        const prereqsMet = perk.prerequisites.every(prereqId => unlockedPerkIDs.includes(prereqId));
        if (prereqsMet) {
            cascadePoints -= perk.cost;
            unlockedPerkIDs.push(perkId);
            console.log(`Purchased Perk: ${perk.name}`);
            applyPerkEffects(); // Apply immediately if needed
            updatePerkShopUI();
            updateUI(); // Update main UI if needed
            saveProgress();
        } else {
            console.warn(`Cannot purchase ${perk.name}: Prerequisites not met.`);
            // Optionally show a message to the user
        }
    } else {
        console.warn(`Cannot purchase ${perk?.name || perkId}: Already unlocked or insufficient CP.`);
        // Optionally show a message to the user
    }
}

function addPurchaseButtonListeners() {
    const buttons = perkListElement.querySelectorAll('.purchase-perk-button');
    // Remove old listeners before adding new ones to prevent duplicates
    buttons.forEach(button => button.removeEventListener('click', handlePerkPurchase));
    buttons.forEach(button => button.addEventListener('click', handlePerkPurchase));
}

// --- Helper: Get Random Reward Based on Weights ---
function getRandomReward() {
    const totalWeight = SPECIAL_REWARDS.reduce((sum, reward) => sum + reward.weight, 0);
    let randomRoll = Math.random() * totalWeight;
    for (const reward of SPECIAL_REWARDS) {
        if (randomRoll < reward.weight) return reward;
        randomRoll -= reward.weight;
    }
    return SPECIAL_REWARDS[SPECIAL_REWARDS.length - 1]; // Fallback
}

// --- Helper: Apply Reward Effect ---
function applyReward(reward) {
    showFeedbackText(reward.message);
    deactivateCurrentPowerUp(); // Prevent stacking

    switch (reward.type) {
        case 'CP':
            cascadePoints += reward.value;
            if (cpDisplayElement && !perkShopElement.classList.contains('hidden')) {
                cpDisplayElement.textContent = cascadePoints; // Update shop if open
            }
            // CP saved at game over
            break;
        case 'POWERUP':
            activePowerUp = reward.effect;
            powerUpTimer = reward.duration;
            switch (reward.effect) {
                case 'slowmo':
                    // Speed adjustment happens in update() based on activePowerUp
                    originalGameSpeed = gameSpeed; // Store current speed before slowmo potentially changes it
                    break;
                case 'invincible':
                    // Effect checked in update() miss logic
                    break;
                case 'score_multi':
                    temporaryScoreMultiplier = reward.value;
                    break;
            }
            break;
    }
}

// --- Helper: Deactivate Current Power-up ---
function deactivateCurrentPowerUp() {
    if (!activePowerUp) return;
    console.log("Deactivating power-up:", activePowerUp);
    switch (activePowerUp) {
        case 'slowmo':
            // Speed is automatically restored in update() when activePowerUp is null
            break;
        case 'invincible':
            break;
        case 'score_multi':
            temporaryScoreMultiplier = 1;
            break;
    }
    activePowerUp = null;
    powerUpTimer = 0;
}

// --- Helper: Show Feedback Text on Canvas ---
function showFeedbackText(text) {
    feedbackText = text;
    feedbackTextTimer = FEEDBACK_TEXT_DURATION;
}

// --- Initialize game when page loads ---
window.addEventListener('load', init);