import { TILE_SIZE, DIRECTIONS } from '../utils/constants.js';

export class Enemy {
    constructor(x, y, type, speed, level = 1) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.baseSpeed = speed;
        this.speed = speed + (level - 1) * 0.1; // Increase speed with level
        this.level = level;

        // Movement
        this.direction = DIRECTIONS.DOWN;
        this.isMoving = true;
        this.isGhosting = false; // Moving through dirt (ghost mode)

        // Ghost mode transformation timer
        this.ghostModeTimer = 0;
        this.canGhostMode = false; // Becomes true after 5 seconds
        this.GHOST_MODE_DELAY = 5000; // 5 seconds before can ghost
        this.inTunnel = true; // Track if currently in tunnel
        this.tunnelDirection = null; // Direction of tunnel (horizontal/vertical)

        // AI state
        this.state = 'roaming'; // roaming, chasing
        this.targetX = x;
        this.targetY = y;
        this.stateTimer = 0;
        this.directionChangeTimer = 0;

        // Inflation (when pumped)
        this.isInflating = false;
        this.inflateLevel = 1.0;
        this.inflateTimer = 0;

        // Animation
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.eyeFlashTimer = 0; // For flashing eyes effect in ghost mode

        // Distance from player (for scoring)
        this.distanceFromPlayer = 0;
    }

    /**
     * Update enemy state
     */
    update(deltaTime, player, grid) {
        // Check current position - are we in a tunnel?
        const { x: gx, y: gy } = grid.pixelToGrid(this.x, this.y);
        const currentlyInTunnel = grid.isEmpty(gx, gy);

        // If we just entered a tunnel from dirt, reset ghost mode timer
        if (currentlyInTunnel && !this.inTunnel) {
            // Just entered tunnel - disable ghost mode for 5 seconds
            this.ghostModeTimer = 0;
            this.canGhostMode = false;
            this.isGhosting = false;

            // Detect tunnel direction (horizontal or vertical)
            this.tunnelDirection = this.detectTunnelDirection(gx, gy, grid);

            // Immediately pick a valid direction for the tunnel
            this.pickValidDirection(grid);
        }

        this.inTunnel = currentlyInTunnel;

        // Update ghost mode timer (only counts up when conditions are met)
        this.ghostModeTimer += deltaTime;
        if (this.ghostModeTimer >= this.GHOST_MODE_DELAY) {
            this.canGhostMode = true;
        }

        // Update AI state
        this.updateAI(deltaTime, player, grid);

        // Update inflation if being pumped
        if (this.isInflating) {
            this.updateInflation(deltaTime);
        }

        // Move enemy
        if (this.isMoving && !this.isInflating) {
            this.move(grid);
        }

        // Update animation
        this.updateAnimation(deltaTime);

        // Update eye flash animation for ghost mode
        if (this.isGhosting) {
            this.eyeFlashTimer += deltaTime;
        }

        // Calculate distance from player for scoring
        if (player) {
            const dx = this.x - player.x;
            const dy = this.y - player.y;
            this.distanceFromPlayer = Math.sqrt(dx * dx + dy * dy);
        }
    }

    /**
     * Update AI behavior
     */
    updateAI(deltaTime, player, grid) {
        this.stateTimer += deltaTime;
        this.directionChangeTimer += deltaTime;

        // Switch between roaming and chasing
        if (this.stateTimer > 3000) {
            this.state = this.state === 'roaming' ? 'chasing' : 'roaming';
            this.stateTimer = 0;
        }

        if (this.state === 'chasing' && player) {
            this.chasePlayer(player, grid);
        } else {
            this.roam(grid);
        }
    }

    /**
     * Chase the player
     */
    chasePlayer(player, grid) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;

        // Choose direction based on larger distance
        if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        } else {
            this.direction = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        }
    }

    /**
     * Roam - follow tunnel direction if in tunnel without ghost mode
     */
    roam(grid) {
        // Random direction changes
        if (this.directionChangeTimer > 1000 + Math.random() * 1000) {
            this.pickValidDirection(grid);
            this.directionChangeTimer = 0;
        }
    }

    /**
     * Detect if tunnel is horizontal or vertical
     */
    detectTunnelDirection(gx, gy, grid) {
        const hasLeft = grid.isEmpty(gx - 1, gy);
        const hasRight = grid.isEmpty(gx + 1, gy);
        const hasUp = grid.isEmpty(gx, gy - 1);
        const hasDown = grid.isEmpty(gx, gy + 1);

        const horizontalOpen = hasLeft || hasRight;
        const verticalOpen = hasUp || hasDown;

        // Determine primary direction based on what's open
        if (horizontalOpen && !verticalOpen) {
            return 'horizontal';
        } else if (verticalOpen && !horizontalOpen) {
            return 'vertical';
        } else if (horizontalOpen && verticalOpen) {
            // Intersection - choose based on current direction
            if (
                this.direction === DIRECTIONS.LEFT ||
                this.direction === DIRECTIONS.RIGHT
            ) {
                return 'horizontal';
            } else {
                return 'vertical';
            }
        }

        return null; // Enclosed, shouldn't happen
    }

    /**
     * Move enemy
     */
    move(grid) {
        let newX = this.x;
        let newY = this.y;

        // Determine if currently in dirt
        const { x: gx, y: gy } = grid.pixelToGrid(this.x, this.y);
        const inDirt = grid.isDirt(gx, gy);

        // Enemies can only ghost through dirt after 2 seconds
        // Before that, they're stuck in tunnels
        let moveSpeed = this.speed;
        if (inDirt) {
            if (this.canGhostMode) {
                // Can ghost through dirt at reduced speed
                moveSpeed = this.speed * 0.6;
                this.isGhosting = true;
            } else {
                // Can't move through dirt yet - stuck in tunnels
                // Try to find a tunnel direction
                this.isGhosting = false;
                return; // Don't move if in dirt and can't ghost yet
            }
        } else {
            this.isGhosting = false;
        }

        switch (this.direction) {
            case DIRECTIONS.UP:
                newY -= moveSpeed;
                break;
            case DIRECTIONS.DOWN:
                newY += moveSpeed;
                break;
            case DIRECTIONS.LEFT:
                newX -= moveSpeed;
                break;
            case DIRECTIONS.RIGHT:
                newX += moveSpeed;
                break;
        }

        // Check boundaries
        if (newX < 0 || newX > grid.width * TILE_SIZE - TILE_SIZE) {
            this.direction =
                this.direction === DIRECTIONS.LEFT
                    ? DIRECTIONS.RIGHT
                    : DIRECTIONS.LEFT;
            return;
        }
        if (newY < 0 || newY > grid.height * TILE_SIZE - TILE_SIZE) {
            this.direction =
                this.direction === DIRECTIONS.UP
                    ? DIRECTIONS.DOWN
                    : DIRECTIONS.UP;
            return;
        }

        // Check if can move to new position
        const canMove = this.canMoveToPosition(newX, newY, grid);

        if (canMove) {
            this.x = newX;
            this.y = newY;
        } else {
            // Hit a rock or can't move, pick a valid direction
            this.pickValidDirection(grid);
        }
    }

    /**
     * Check if enemy can move to position
     */
    canMoveToPosition(x, y, grid) {
        const { x: gx, y: gy } = grid.pixelToGrid(x, y);

        // Enemies cannot move through rocks
        return !grid.isRock(gx, gy);
    }

    /**
     * Pick a valid direction based on what's available
     */
    pickValidDirection(grid) {
        const { x: gx, y: gy } = grid.pixelToGrid(this.x, this.y);
        const validDirections = [];

        // In tunnel without ghost mode: can move in any direction that has a tunnel
        // This allows enemies to turn at intersections
        if (this.inTunnel && !this.canGhostMode) {
            // Check all four directions for tunnels
            if (grid.isEmpty(gx, gy - 1) && !grid.isRock(gx, gy - 1)) {
                validDirections.push(DIRECTIONS.UP);
            }
            if (grid.isEmpty(gx, gy + 1) && !grid.isRock(gx, gy + 1)) {
                validDirections.push(DIRECTIONS.DOWN);
            }
            if (grid.isEmpty(gx - 1, gy) && !grid.isRock(gx - 1, gy)) {
                validDirections.push(DIRECTIONS.LEFT);
            }
            if (grid.isEmpty(gx + 1, gy) && !grid.isRock(gx + 1, gy)) {
                validDirections.push(DIRECTIONS.RIGHT);
            }
        } else {
            // Free roaming - check all directions (can go through dirt if can ghost)
            if (
                !grid.isRock(gx, gy - 1) &&
                (grid.isEmpty(gx, gy - 1) ||
                    (this.canGhostMode && grid.isDirt(gx, gy - 1)))
            ) {
                validDirections.push(DIRECTIONS.UP);
            }
            if (
                !grid.isRock(gx, gy + 1) &&
                (grid.isEmpty(gx, gy + 1) ||
                    (this.canGhostMode && grid.isDirt(gx, gy + 1)))
            ) {
                validDirections.push(DIRECTIONS.DOWN);
            }
            if (
                !grid.isRock(gx - 1, gy) &&
                (grid.isEmpty(gx - 1, gy) ||
                    (this.canGhostMode && grid.isDirt(gx - 1, gy)))
            ) {
                validDirections.push(DIRECTIONS.LEFT);
            }
            if (
                !grid.isRock(gx + 1, gy) &&
                (grid.isEmpty(gx + 1, gy) ||
                    (this.canGhostMode && grid.isDirt(gx + 1, gy)))
            ) {
                validDirections.push(DIRECTIONS.RIGHT);
            }
        }

        // Pick a random valid direction
        if (validDirections.length > 0) {
            this.direction =
                validDirections[
                    Math.floor(Math.random() * validDirections.length)
                ];
        }
    }

    /**
     * Start inflation (when pumped)
     */
    startInflation() {
        if (!this.isInflating) {
            this.isInflating = true;
            this.inflateTimer = 0;
            this.isMoving = false;
        }
    }

    /**
     * Update inflation state
     */
    updateInflation(deltaTime) {
        this.inflateTimer += deltaTime;
        this.inflateLevel = 1.0 + this.inflateTimer / 1000; // Grow over time

        // Pop when fully inflated
        if (this.inflateLevel >= 2.0) {
            this.pop();
        }
    }

    /**
     * Enemy pops (dies)
     */
    pop() {
        // Mark for removal
        this.isDestroyed = true;
    }

    /**
     * Update animation
     */
    updateAnimation(deltaTime) {
        this.animationTimer += deltaTime;
        if (this.animationTimer > 200) {
            this.animationFrame = (this.animationFrame + 1) % 2;
            this.animationTimer = 0;
        }
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
}
