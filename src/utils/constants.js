// Game dimensions
export const TILE_SIZE = 16;
export const GRID_WIDTH = 28;
export const GRID_HEIGHT = 20;
export const CANVAS_WIDTH = GRID_WIDTH * TILE_SIZE;
export const CANVAS_HEIGHT = GRID_HEIGHT * TILE_SIZE;

// Game states
export const GAME_STATES = {
    MENU: 'menu',
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
    SPEED: 2,
    START_LIVES: 3,
    PUMP_RANGE: 64, // pixels
    PUMP_INFLATE_TIME: 1000, // ms to fully inflate enemy
};

// Enemy settings
export const ENEMY_TYPES = {
    POOKA: 'pooka',
    FYGAR: 'fygar',
};

export const ENEMY = {
    POOKA: {
        SPEED: 1.1, // Increased from 0.8 for better gameplay
        POINTS: 200,
        GHOST_SPEED: 0.5, // Speed when moving through dirt
    },
    FYGAR: {
        SPEED: 1.0, // Increased from 0.7 for better gameplay
        POINTS: 400,
        GHOST_SPEED: 0.4,
        FIRE_RANGE: 48, // pixels
        FIRE_COOLDOWN: 3000, // ms
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
    DIRT_LIGHT: '#8B7355',
    DIRT_MID: '#6B5344',
    DIRT_DARK: '#4B3A2F',
    PLAYER_BLUE: '#3498db',
    PLAYER_WHITE: '#ffffff',
    POOKA_RED: '#e74c3c',
    POOKA_YELLOW: '#f1c40f',
    FYGAR_GREEN: '#2ecc71',
    FYGAR_RED: '#e74c3c',
    ROCK_GRAY: '#95a5a6',
    TEXT_WHITE: '#ffffff',
    TEXT_YELLOW: '#f1c40f',
};

// Animation settings
export const ANIMATION = {
    FRAME_DURATION: 150, // ms per frame
    INFLATE_FRAMES: 4,
    WALK_FRAMES: 2,
};

// Rock physics
export const ROCK = {
    FALL_DELAY: 800, // ms delay before rock falls after player triggers it
    FALL_SPEED: 3,
    SHAKE_DURATION: 800, // ms rock shakes before falling (triggered by player from below)
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
    ANIMATION_DURATION: 1000, // 1 second death animation
    RESPAWN_DELAY: 3000, // 3 seconds "Player 1 Ready" display
    INVINCIBILITY_TIME: 2000, // 2 seconds invincibility after respawn
};
