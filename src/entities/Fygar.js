import { Enemy } from './Enemy.js';
import { ENEMY, DIRECTIONS, TILE_SIZE } from '../utils/constants.js';

export class Fygar extends Enemy {
    constructor(x, y, level = 1) {
        super(x, y, 'fygar', ENEMY.FYGAR.SPEED, level);
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

        // If being pumped, cancel any fire activity (charging or firing)
        if (
            this.isInflating &&
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
     * Update fire breath state machine
     */
    updateFireBreath(deltaTime, player, grid) {
        // Update cooldown timer
        if (this.fireState === 'cooldown') {
            this.fireCooldownTimer += deltaTime;
            if (this.fireCooldownTimer >= ENEMY.FYGAR.FIRE_COOLDOWN) {
                this.fireState = 'ready';
                this.fireCooldownTimer = 0;
            }
            return;
        }

        // Ready state - check if we should start charging
        if (this.fireState === 'ready') {
            // Only fire when facing horizontally
            if (
                this.direction !== DIRECTIONS.LEFT &&
                this.direction !== DIRECTIONS.RIGHT
            ) {
                return;
            }

            // Check if player is in fire range and horizontally aligned
            if (this.isPlayerInFireRange(player)) {
                this.startCharging();
            }
            return;
        }

        // Charging state - pause before firing
        if (this.fireState === 'charging') {
            this.fireStateTimer += deltaTime;
            if (this.fireStateTimer >= ENEMY.FYGAR.FIRE_CHARGE_TIME) {
                this.startFiring();
            }
            return;
        }

        // Firing state - fire is active
        if (this.fireState === 'firing') {
            this.fireStateTimer += deltaTime;
            if (this.fireStateTimer >= ENEMY.FYGAR.FIRE_DURATION) {
                this.stopFiring();
            }
            return;
        }
    }

    /**
     * Check if player is in fire range (horizontally aligned and in front)
     */
    isPlayerInFireRange(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;

        // Check if player is horizontally aligned (within same row, with some tolerance)
        if (Math.abs(dy) > TILE_SIZE * 0.75) {
            return false;
        }

        // Check if player is in front based on direction and within range
        if (
            this.direction === DIRECTIONS.RIGHT &&
            dx > 0 &&
            dx < ENEMY.FYGAR.FIRE_RANGE
        ) {
            return true;
        }
        if (
            this.direction === DIRECTIONS.LEFT &&
            dx < 0 &&
            dx > -ENEMY.FYGAR.FIRE_RANGE
        ) {
            return true;
        }

        return false;
    }

    /**
     * Start charging phase (pause before fire)
     */
    startCharging() {
        this.fireState = 'charging';
        this.fireStateTimer = 0;
        this.fireDirection = this.direction; // Lock fire direction
        this.isMoving = false; // Stop moving while charging/firing
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
     * Calculate the fire hitbox based on current position and direction
     */
    calculateFireHitbox() {
        const centerY = this.y + TILE_SIZE / 2;

        if (this.fireDirection === DIRECTIONS.RIGHT) {
            this.fireHitbox = {
                x: this.x + TILE_SIZE, // Start from right edge of Fygar
                y: centerY - TILE_SIZE / 4, // Vertically centered with some height
                width: ENEMY.FYGAR.FIRE_RANGE,
                height: TILE_SIZE / 2,
            };
        } else {
            // LEFT
            this.fireHitbox = {
                x: this.x - ENEMY.FYGAR.FIRE_RANGE, // Start from 3 tiles to the left
                y: centerY - TILE_SIZE / 4,
                width: ENEMY.FYGAR.FIRE_RANGE,
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
    }

    /**
     * Cancel fire (when pumped from behind during charge)
     */
    cancelFire() {
        this.fireState = 'cooldown';
        this.fireStateTimer = 0;
        this.fireCooldownTimer = 0;
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
        return this.fireDirection;
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
