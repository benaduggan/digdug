// Game dimensions
export const TILE_SIZE = 16;
export const GRID_WIDTH = 27;
export const GRID_HEIGHT = 18;
export const CANVAS_WIDTH = GRID_WIDTH * TILE_SIZE;
export const CANVAS_HEIGHT = GRID_HEIGHT * TILE_SIZE;
export const HI_SCORE_KEY = 'digdug_highscore';

// Game states
export const GAME_STATES = {
    MENU: 'menu',
    INTRO: 'intro', // Starting animation before gameplay
    PLAYING: 'playing',
    PAUSED: 'paused',
    DYING: 'dying',
    RESPAWNING: 'respawning',
    LEVEL_COMPLETE: 'level_complete',
    GAME_OVER: 'game_over',
};

// Tile types
export const TILE_TYPES = {
    EMPTY: 0,
    DIRT: 1,
    ROCK: 2,
};

// Directions
export const DIRECTIONS = {
    UP: 'up',
    DOWN: 'down',
    LEFT: 'left',
    RIGHT: 'right',
};

// Player settings
export const PLAYER = {
    SPEED: 1.2, // Pixels per frame - player should feel responsive
    START_LIVES: 3,
    PUMP_RANGE: TILE_SIZE * 3,
};

// Enemy settings
export const ENEMY_TYPES = {
    POOKA: 'pooka',
    FYGAR: 'fygar',
};

export const ENEMY = {
    MIN_GHOST_DURATION: 1200, // Must ghost for at least 1.2 seconds
    POOKA: {
        SPEED: 0.7, // Pixels per frame in tunnels
        POINTS: 200,
        GHOST_SPEED: 0.5, // Speed when moving through dirt
        GHOST_MODE_DELAY: () => 5000 + Math.floor(Math.random() * 3) * 2500, // 5, 7.5, or 10 seconds before entering ghost mode
    },
    FYGAR: {
        SPEED: 0.6, // Pixels per frame in tunnels
        POINTS: 400,
        GHOST_SPEED: 0.4,
        GHOST_MODE_DELAY: 10000, // 10 seconds before entering ghost mode
        FIRE_RANGE: TILE_SIZE * 4,
        FIRE_COOLDOWN: 2500, // 2.5 seconds between fire breaths
        FIRE_CHARGE_TIME: 300, // ms pause before breathing fire
        FIRE_DURATION: 450, // 450ms fire stays visible (150ms per tile extension)
    },
};

// Scoring
export const SCORES = {
    POOKA_BASE: 200,
    FYGAR_BASE: 400,
    ROCK_KILL: 1000,
    BONUS_ITEM: 500,
    DISTANCE_MULTIPLIER: 50, // Points per tile away from player when killed
};

// Colors (arcade-accurate)
export const COLORS = {
    BACKGROUND: '#000000',
    SKY: 'rgb(0, 0, 145)', // Blue sky for top rows
    DIRT_LIGHT: 'rgb(244, 187, 64)',
    DIRT_MID: 'rgb(207, 111, 41)',
    DIRT_DARK: 'rgb(169, 49, 24)',
    DIRT_DARKEST: 'rgb(138, 26, 16)',
    PLAYER_BLUE: '#3498db',
    PLAYER_WHITE: '#ffffff',
    POOKA_RED: '#e74c3c',
    POOKA_YELLOW: '#f1c40f',
    FYGAR_GREEN: '#2ecc71',
    FYGAR_RED: '#e74c3c',
    ROCK_GRAY: '#95a5a6',
    TEXT_WHITE: '#ffffff',
    TEXT_RED: '#e33122',
};

export const DIRT_GRADIENT = [
    { stop: 0.0, color: rgbStringToHSL(COLORS.DIRT_LIGHT) },
    { stop: 0.33, color: rgbStringToHSL(COLORS.DIRT_MID) },
    { stop: 0.66, color: rgbStringToHSL(COLORS.DIRT_DARK) },
    { stop: 1.0, color: rgbStringToHSL(COLORS.DIRT_DARKEST) },
];

function rgbStringToHSL(rgbStr) {
    // Extract numbers
    const [r, g, b] = rgbStr.match(/\d+/g).map(Number);

    // Normalize to 0-1
    const rN = r / 255;
    const gN = g / 255;
    const bN = b / 255;

    const max = Math.max(rN, gN, bN);
    const min = Math.min(rN, gN, bN);
    let h, s;
    const l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // Achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case rN:
                h = (gN - bN) / d + (gN < bN ? 6 : 0);
                break;
            case gN:
                h = (bN - rN) / d + 2;
                break;
            case bN:
                h = (rN - gN) / d + 4;
                break;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

// Animation settings
export const ANIMATION = {
    FRAME_DURATION: 150, // ms per frame
    INFLATE_FRAMES: 4,
    WALK_FRAMES: 2,
};

// Rock physics
export const ROCK = {
    FALL_DELAY: 300, // 400ms delay before rock falls after player triggers it
    FALL_SPEED: 3, // Pixels per frame when falling
    SHAKE_DURATION: 200, // ms rock shakes before falling (triggered by player from below)
};

// Level settings
export const LEVEL = {
    START_ENEMIES: 4,
    MAX_ENEMIES: 8,
    ENEMY_INCREMENT: 1, // Additional enemies per level
    ROCKS_PER_LEVEL: 3,
    ROCKS_FOR_BONUS: 2, // Number of rocks dropped to spawn bonus
};

// Death settings
export const DEATH = {
    ANIMATION_DURATION: 1500, // 1.5 second death animation
    RESPAWN_DELAY: 3000, // 3 seconds "Player 1 Ready" display
    INVINCIBILITY_TIME: 2000, // 2 seconds invincibility after respawn
};
