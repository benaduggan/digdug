import { TILE_SIZE, ROCK } from '../utils/constants.js';

export class Rock {
    constructor(x, y, grid) {
        this.x = x;
        this.y = y;
        this.grid = grid;

        // State
        this.isFalling = false;
        this.isShaking = false;
        this.shakeTimer = 0;
        this.fallDelay = ROCK.FALL_DELAY;
        this.fallSpeed = ROCK.FALL_SPEED;

        // Crumbling state (when hits dirt without killing enemy)
        this.isCrumbling = false;
        this.crumbleTimer = 0;
        this.CRUMBLE_DURATION = 300; // ms to show crumble animation

        // Track if rock crushed any enemies
        this.crushedEnemy = false;

        // Track player position to wait for them to move
        this.playerStillBelow = false;
        this.playerLastX = 0;
        this.playerLastY = 0;

        // Fall delay timer (starts after player clears from underneath)
        this.fallDelayTimer = 0;
        this.waitingToFall = false;

        // Grid position
        this.gridX = Math.floor(x / TILE_SIZE);
        this.gridY = Math.floor(y / TILE_SIZE);
    }

    /**
     * Update rock state
     */
    update(deltaTime, grid, player) {
        // Update crumbling animation
        if (this.isCrumbling) {
            this.crumbleTimer += deltaTime;
            if (this.crumbleTimer > this.CRUMBLE_DURATION) {
                this.isDestroyed = true; // Mark for removal
            }
            return; // Don't process anything else while crumbling
        }

        // Update shaking
        if (this.isShaking) {
            this.shakeTimer += deltaTime;

            // After initial shake duration, check if player has cleared
            if (this.shakeTimer > ROCK.SHAKE_DURATION) {
                if (player && this.playerStillBelow) {
                    // Check if player has fully cleared from underneath the rock
                    const playerCleared = this.hasPlayerCleared(player);

                    if (playerCleared) {
                        this.playerStillBelow = false;
                        this.waitingToFall = true;
                        this.fallDelayTimer = 0;
                    }
                } else if (!this.waitingToFall) {
                    // Player wasn't below, start falling immediately
                    this.startFalling(grid);
                }
            }
        }

        // Update fall delay timer (after player has cleared)
        if (this.waitingToFall) {
            this.fallDelayTimer += deltaTime;
            if (this.fallDelayTimer >= this.fallDelay) {
                this.waitingToFall = false;
                this.startFalling(grid);
            }
        }

        // Update falling
        if (this.isFalling) {
            this.fall(grid);
        }

        // Check if player is touching rock from below to trigger fall
        if (!this.isFalling && !this.isShaking && player) {
            this.checkPlayerTrigger(player, grid);
        }
    }

    /**
     * Check if player is touching rock from below
     */
    checkPlayerTrigger(player, grid) {
        // Check if there's no dirt below the rock
        const hasDirtBelow = grid.isDirt(this.gridX, this.gridY + 1);
        const hasRockBelow = grid.isRock(this.gridX, this.gridY + 1);

        if (hasDirtBelow || hasRockBelow || this.gridY >= grid.height - 1) {
            return; // Rock is supported, can't fall
        }

        // Check if player is directly below the rock
        const playerGridX = Math.floor(player.x / TILE_SIZE);
        const playerGridY = Math.floor(player.y / TILE_SIZE);

        // Player must be in the tile directly below or diagonally adjacent below
        const isBelow =
            playerGridY === this.gridY + 1 &&
            Math.abs(playerGridX - this.gridX) <= 1;

        // Also check if player's head is touching rock's bottom
        const playerTop = player.y;
        const rockBottom = this.y + TILE_SIZE;
        const verticalOverlap = Math.abs(playerTop - rockBottom) < 4;
        const horizontalOverlap = Math.abs(player.x - this.x) < TILE_SIZE;

        if (
            (isBelow && verticalOverlap && horizontalOverlap) ||
            (verticalOverlap && horizontalOverlap && player.y < this.y)
        ) {
            // Player touched from below, trigger the rock
            this.playerStillBelow = true;
            this.playerLastX = player.x;
            this.playerLastY = player.y;
            this.startShaking();
        }
    }

    /**
     * Check if player has fully cleared from underneath the rock
     */
    hasPlayerCleared(player) {
        // Player must be completely outside the rock's horizontal range
        const playerLeft = player.x;
        const playerRight = player.x + TILE_SIZE;
        const rockLeft = this.x;
        const rockRight = this.x + TILE_SIZE;

        // Check horizontal clearance (no overlap)
        const horizontalClear =
            playerRight <= rockLeft || playerLeft >= rockRight;

        // Also check if player moved to a different row (vertically clear)
        const playerGridY = Math.floor(player.y / TILE_SIZE);
        const verticalClear = playerGridY !== this.gridY + 1;

        return horizontalClear || verticalClear;
    }

    /**
     * Start shaking animation
     */
    startShaking() {
        this.isShaking = true;
        this.shakeTimer = 0;
    }

    /**
     * Start falling
     */
    startFalling(grid) {
        this.isFalling = true;
        this.isShaking = false;

        // Remove rock from grid
        grid.removeRock(this.gridX, this.gridY);
    }

    /**
     * Fall downward
     */
    fall(grid) {
        this.y += this.fallSpeed;

        // Update grid position
        const newGridY = Math.floor(this.y / TILE_SIZE);

        if (newGridY !== this.gridY) {
            this.gridY = newGridY;

            // Check what's below: dirt, rock, or bottom
            const hasDirtBelow = grid.isDirt(this.gridX, this.gridY + 1);
            const hasRockBelow = grid.isRock(this.gridX, this.gridY + 1);
            const hitBottom = this.gridY >= grid.height - 1;

            if (hasDirtBelow || hasRockBelow || hitBottom) {
                this.stopFalling(hasDirtBelow);
            }
        }
    }

    /**
     * Stop falling - crumble after landing
     */
    stopFalling(hitDirt) {
        this.isFalling = false;

        // Snap to grid
        this.y = this.gridY * TILE_SIZE;

        // Rock always crumbles after falling (whether it crushed an enemy or hit dirt)
        if (hitDirt || this.crushedEnemy) {
            this.isCrumbling = true;
            this.crumbleTimer = 0;
        }
    }

    /**
     * Mark that this rock crushed an enemy
     */
    markEnemyCrushed() {
        this.crushedEnemy = true;
    }

    /**
     * Get center position
     */
    getCenter() {
        return {
            x: this.x + TILE_SIZE / 2,
            y: this.y + TILE_SIZE / 2,
        };
    }

    /**
     * Reset rock state (called on player respawn)
     */
    reset() {
        this.isShaking = false;
        this.shakeTimer = 0;
        this.playerStillBelow = false;
        this.waitingToFall = false;
        this.fallDelayTimer = 0;
        // Note: don't reset isFalling or position - falling rocks continue falling
    }
}
