import { Enemy } from './Enemy.js';
import {
    ENEMY,
    DIRECTIONS,
    TILE_SIZE,
    ENEMY_TYPES,
} from '../utils/constants.js';

export class Fygar extends Enemy {
    constructor(x, y, level = 1) {
        super(x, y, ENEMY_TYPES.FYGAR, ENEMY.FYGAR.SPEED, level);
        this.ghostSpeed = ENEMY.FYGAR.GHOST_SPEED;

        // Fire breathing state machine: 'ready' -> 'charging' -> 'firing' -> 'cooldown' -> 'ready'
        this.fireState = 'ready';
        this.fireStateTimer = 0;
        this.fireCooldownTimer = 0;

        // Fire breath direction (locked when charging starts)
        this.fireDirection = null;

        // Fire hitbox properties (calculated when firing)
        this.fireHitbox = null;
    }

    /**
     * Update Fygar-specific behavior
     */
    update(deltaTime, player, grid) {
        super.update(deltaTime, player, grid);

        // Handle fire breathing state machine
        // Only can breathe fire when in a tunnel (not ghosting through dirt)
        if (player && !this.isInflating && !this.isGhosting) {
            this.updateFireBreath(deltaTime, player, grid);
        }

        // If being pumped (or already inflated), cancel any fire activity (charging or firing)
        // Check both isInflating and inflateLevel > 1 to catch the pump on first contact
        if (
            (this.isInflating || this.inflateLevel > 1.0) &&
            (this.fireState === 'charging' || this.fireState === 'firing')
        ) {
            this.cancelFire();
        }

        // If started ghosting while charging or firing, cancel the fire
        if (
            this.isGhosting &&
            (this.fireState === 'charging' || this.fireState === 'firing')
        ) {
            this.cancelFire();
        }
    }

    /**
     * Override ghost mode update to pause timer while charging/firing
     * Fygar should not accumulate ghost mode time while breathing fire
     */
    updateGhostMode(deltaTime, player, grid) {
        // If currently charging or firing, don't update ghost mode at all
        // This pauses the ghost timer while Fygar is breathing fire
        if (this.fireState === 'charging' || this.fireState === 'firing') {
            return;
        }

        // Otherwise use parent implementation
        super.updateGhostMode(deltaTime, player, grid);
    }

    /**
     * Update fire breath state machine
     */
    updateFireBreath(deltaTime, player, grid) {
        const state = this.fireState;

        // 1. Cooldown
        if (state === 'cooldown') {
            this.fireCooldownTimer += deltaTime;
            if (this.fireCooldownTimer >= ENEMY.FYGAR.FIRE_COOLDOWN) {
                this.fireState = 'ready';
                this.fireCooldownTimer = 0;
                this.fireDirection = null;
            }
            return;
        }

        // 2. Ready State (Decision making)
        if (state === 'ready') {
            const dir = this.direction;

            // Fast exit: Can only fire if horizontal
            if (dir !== DIRECTIONS.LEFT && dir !== DIRECTIONS.RIGHT) return;

            // Optimization: Simple X check before expensive range checks
            const isFacingRight = dir === DIRECTIONS.RIGHT;

            // If facing right, player MUST be to the right (x > x).
            // If facing left, player MUST be to the left (x < x).
            // This acts as a "Guard Clause" to skip the heavy isPlayerInFireRange logic.
            if (isFacingRight ? player.x <= this.x : player.x >= this.x) return;

            // Now perform the strict grid/range check
            if (this.isPlayerInFireRange(player, grid)) {
                this.fireDirection = dir; // Lock direction
                this.startCharging();
            }
            return;
        }

        // 3. Charging / Firing (Execution)
        // We increment the timer for both states here to avoid duplicate code
        this.fireStateTimer += deltaTime;

        if (state === 'charging') {
            if (this.fireStateTimer >= ENEMY.FYGAR.FIRE_CHARGE_TIME) {
                this.startFiring();
            }
        } else if (state === 'firing') {
            this.calculateFireHitbox();
            if (this.fireStateTimer >= ENEMY.FYGAR.FIRE_DURATION) {
                this.stopFiring();
            }
        }
    }

    /**
     * Check if player is in fire range (horizontally aligned and in front)
     * Also checks that no dirt blocks the fire path
     */
    isPlayerInFireRange(player, grid) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;

        // Check if player is horizontally aligned (within same row, with some tolerance)
        if (Math.abs(dy) > TILE_SIZE * 0.75) {
            return false;
        }

        // Check if player is in front based on direction and within range
        const inRange =
            (this.direction === DIRECTIONS.RIGHT &&
                dx > 0 &&
                dx < ENEMY.FYGAR.FIRE_RANGE) ||
            (this.direction === DIRECTIONS.LEFT &&
                dx < 0 &&
                dx > -ENEMY.FYGAR.FIRE_RANGE);

        if (!inRange) {
            return false;
        }

        // Check for dirt blocking the fire path
        const fygarGridX = Math.floor((this.x + TILE_SIZE / 2) / TILE_SIZE);
        const playerGridX = Math.floor((player.x + TILE_SIZE / 2) / TILE_SIZE);
        const gridY = Math.floor((this.y + TILE_SIZE / 2) / TILE_SIZE);

        const startX = Math.min(fygarGridX, playerGridX);
        const endX = Math.max(fygarGridX, playerGridX);

        // Check all tiles between Fygar and player for dirt
        for (let x = startX + 1; x < endX; x++) {
            if (grid.isDirt(x, gridY)) {
                return false; // Dirt blocks fire
            }
        }

        return true;
    }

    /**
     * Start charging phase (pause before fire)
     */
    startCharging() {
        this.fireState = 'charging';
        this.fireStateTimer = 0;
        this.isMoving = false;

        // The Snap (This is where the X/Y changes)
        const gx = Math.floor((this.x + TILE_SIZE / 2) / TILE_SIZE);
        const gy = Math.floor((this.y + TILE_SIZE / 2) / TILE_SIZE);
        this.x = gx * TILE_SIZE;
        this.y = gy * TILE_SIZE;

        this.lastGridX = gx;
        this.lastGridY = gy;
    }

    /**
     * Start firing phase (fire is now active and can damage player)
     */
    startFiring() {
        this.fireState = 'firing';
        this.fireStateTimer = 0;
        this.calculateFireHitbox();
    }

    /**
     * Calculate the fire hitbox based on current position, direction, and tile count
     * Hitbox grows as fire extends: 1 tile -> 2 tiles -> 3 tiles
     */
    calculateFireHitbox() {
        // Get current fire length in tiles (1-3)
        const tileCount = this.getFireTileCount();
        if (tileCount === 0) {
            this.fireHitbox = null;
            return;
        }

        const fireWidth = tileCount * TILE_SIZE;
        const centerY = this.y + TILE_SIZE / 2;

        if (this.fireDirection === DIRECTIONS.RIGHT) {
            this.fireHitbox = {
                x: this.x + TILE_SIZE, // Start from right edge of Fygar
                y: centerY - TILE_SIZE / 4, // Vertically centered with some height
                width: fireWidth,
                height: TILE_SIZE / 2,
            };
        } else {
            // LEFT
            this.fireHitbox = {
                x: this.x - fireWidth, // Start from current fire length to the left
                y: centerY - TILE_SIZE / 4,
                width: fireWidth,
                height: TILE_SIZE / 2,
            };
        }
    }

    /**
     * Stop firing and enter cooldown
     */
    stopFiring() {
        this.fireState = 'cooldown';
        this.fireStateTimer = 0;
        this.fireCooldownTimer = 0;
        this.fireHitbox = null;
        this.fireDirection = null;
        this.isMoving = true; // Resume movement

        // Sync grid tracking to current position to prevent "new tile" detection glitch
        const gx = Math.floor((this.x + TILE_SIZE / 2) / TILE_SIZE);
        const gy = Math.floor((this.y + TILE_SIZE / 2) / TILE_SIZE);
        this.lastGridX = gx;
        this.lastGridY = gy;
    }

    /**
     * Cancel fire (when pumped during charge/fire)
     */
    cancelFire() {
        this.fireState = 'cooldown';
        this.fireStateTimer = 0;
        // Start cooldown partway through so recovery is faster after being interrupted
        this.fireCooldownTimer = ENEMY.FYGAR.FIRE_COOLDOWN * 0.5;
        this.fireHitbox = null;
        this.fireDirection = null;
        // Don't resume movement - inflation handles that
    }

    /**
     * Check if fire is currently active and dangerous
     */
    isFireActive() {
        return this.fireState === 'firing' && this.fireHitbox !== null;
    }

    /**
     * Check if currently charging (for visual feedback)
     */
    isCharging() {
        return this.fireState === 'charging';
    }

    /**
     * Get fire hitbox for collision detection
     */
    getFireHitbox() {
        return this.fireHitbox;
    }

    /**
     * Get fire direction for rendering
     */
    getFireDirection() {
        return this.fireDirection || this.direction;
    }

    /**
     * Get current fire length in tiles (1-3) based on fire timer progress
     * Fire extends over the duration: 1 tile -> 2 tiles -> 3 tiles
     */
    getFireTileCount() {
        if (this.fireState !== 'firing') {
            return 0;
        }
        // Divide fire duration into 3 phases
        const progress = this.fireStateTimer / ENEMY.FYGAR.FIRE_DURATION;
        if (progress < 0.33) {
            return 1;
        } else if (progress < 0.66) {
            return 2;
        } else {
            return 3;
        }
    }

    /**
     * Reset timers - called on respawn
     */
    resetTimers() {
        super.resetTimers();
        this.fireState = 'ready';
        this.fireStateTimer = 0;
        this.fireCooldownTimer = 0;
        this.fireDirection = null;
        this.fireHitbox = null;
    }
}
