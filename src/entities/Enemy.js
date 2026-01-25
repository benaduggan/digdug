import { TILE_SIZE, DIRECTIONS } from '../utils/constants.js';

/**
 * Enemy class - Refactored for cleaner, more maintainable behavior
 * Phase 1: Basic tunnel movement only
 */
export class Enemy {
    constructor(x, y, type, speed, level = 1) {
        // Position (pixel coordinates)
        this.x = x;
        this.y = y;

        // Type and level
        this.type = type;
        this.level = level;

        // Speed (increases with level)
        this.baseSpeed = speed;
        this.speed = speed + (level - 1) * 0.1;

        // Movement state
        this.direction = DIRECTIONS.DOWN;
        this.isMoving = true;
        this.directionInitialized = false;

        // Animation
        this.animationFrame = 0;
        this.animationTimer = 0;

        // Inflation (when pumped)
        this.isInflating = false;
        this.inflateLevel = 1.0;
        this.inflateTimer = 0;

        // Destruction flag
        this.isDestroyed = false;

        // Distance from player (for scoring)
        this.distanceFromPlayer = 0;
    }

    /**
     * Update enemy state
     */
    update(deltaTime, player, grid) {
        // Initialize direction on first update if needed
        if (!this.directionInitialized) {
            this.initializeDirection(grid);
            this.directionInitialized = true;
        }

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

        // Calculate distance from player for scoring
        if (player) {
            const dx = this.x - player.x;
            const dy = this.y - player.y;
            this.distanceFromPlayer = Math.sqrt(dx * dx + dy * dy);
        }
    }

    /**
     * Move enemy - Phase 1: Simple tunnel bouncing
     */
    move(grid) {
        // Calculate new position based on direction
        let newX = this.x;
        let newY = this.y;

        switch (this.direction) {
            case DIRECTIONS.UP:
                newY -= this.speed;
                break;
            case DIRECTIONS.DOWN:
                newY += this.speed;
                break;
            case DIRECTIONS.LEFT:
                newX -= this.speed;
                break;
            case DIRECTIONS.RIGHT:
                newX += this.speed;
                break;
        }

        // Check if can move to new position
        const canMove = this.canMoveToPosition(newX, newY, grid);

        if (canMove) {
            // Move to new position
            this.x = newX;
            this.y = newY;

            // Apply grid snapping for tunnel centering
            this.applyGridSnapping(grid);
        } else {
            // Hit a wall or invalid tile, reverse direction
            this.reverseDirection();
        }
    }

    /**
     * Check if enemy can move to position
     * Phase 1: Only allow movement in empty tunnels, block rocks
     */
    canMoveToPosition(x, y, grid) {
        // Check multiple points on the enemy sprite to ensure it's fully in tunnel
        // We'll check center, and points near each edge based on movement direction
        const centerX = x + TILE_SIZE / 2;
        const centerY = y + TILE_SIZE / 2;
        const { x: gxCenter, y: gyCenter } = grid.pixelToGrid(centerX, centerY);

        // Always check center first
        if (
            grid.isRock(gxCenter, gyCenter) ||
            !grid.isEmpty(gxCenter, gyCenter)
        ) {
            return false;
        }

        let checkX = centerX;
        let checkY = centerY;

        switch (this.direction) {
            case DIRECTIONS.UP:
                checkY = y;
                break;
            case DIRECTIONS.DOWN:
                checkY = y + TILE_SIZE;
                break;
            case DIRECTIONS.LEFT:
                checkX = x;
                break;
            case DIRECTIONS.RIGHT:
                checkX = x + TILE_SIZE;
                break;
        }

        const { x: gxEdge, y: gyEdge } = grid.pixelToGrid(checkX, checkY);

        // Cannot move if leading edge would be in rock or dirt
        if (grid.isRock(gxEdge, gyEdge) || !grid.isEmpty(gxEdge, gyEdge)) {
            return false;
        }

        return true;
    }

    /**
     * Apply grid snapping to keep enemy centered in tunnels
     */
    applyGridSnapping(grid) {
        const { x: gx, y: gy } = grid.pixelToGrid(this.x, this.y);

        // Only snap if currently in a tunnel
        if (!grid.isEmpty(gx, gy)) {
            return;
        }

        // When moving horizontally, align vertically to grid center
        if (
            this.direction === DIRECTIONS.LEFT ||
            this.direction === DIRECTIONS.RIGHT
        ) {
            const centerY = this.y + TILE_SIZE / 2;
            const gridY = Math.floor(centerY / TILE_SIZE);
            const targetY = gridY * TILE_SIZE;
            const diff = targetY - this.y;

            if (Math.abs(diff) > 0) {
                const snapAmount =
                    Math.sign(diff) * Math.min(Math.abs(diff), this.speed);
                const testY = this.y + snapAmount;

                // Only snap if the snapped position is still in a tunnel
                const testCenterY = testY + TILE_SIZE / 2;
                const testGridY = Math.floor(testCenterY / TILE_SIZE);
                if (grid.isEmpty(gx, testGridY)) {
                    this.y = testY;
                }
            }
        }

        // When moving vertically, align horizontally to grid center
        if (
            this.direction === DIRECTIONS.UP ||
            this.direction === DIRECTIONS.DOWN
        ) {
            const centerX = this.x + TILE_SIZE / 2;
            const gridX = Math.floor(centerX / TILE_SIZE);
            const targetX = gridX * TILE_SIZE;
            const diff = targetX - this.x;

            if (Math.abs(diff) > 0) {
                const snapAmount =
                    Math.sign(diff) * Math.min(Math.abs(diff), this.speed);
                const testX = this.x + snapAmount;

                // Only snap if the snapped position is still in a tunnel
                const testCenterX = testX + TILE_SIZE / 2;
                const testGridX = Math.floor(testCenterX / TILE_SIZE);
                if (grid.isEmpty(testGridX, gy)) {
                    this.x = testX;
                }
            }
        }
    }

    /**
     * Reverse current direction (bounce back)
     */
    reverseDirection() {
        switch (this.direction) {
            case DIRECTIONS.UP:
                this.direction = DIRECTIONS.DOWN;
                break;
            case DIRECTIONS.DOWN:
                this.direction = DIRECTIONS.UP;
                break;
            case DIRECTIONS.LEFT:
                this.direction = DIRECTIONS.RIGHT;
                break;
            case DIRECTIONS.RIGHT:
                this.direction = DIRECTIONS.LEFT;
                break;
        }
    }

    /**
     * Initialize direction based on tunnel orientation
     */
    initializeDirection(grid) {
        const { x: gx, y: gy } = grid.pixelToGrid(
            this.x + TILE_SIZE / 2,
            this.y + TILE_SIZE / 2
        );

        // Check all four directions to see which ones have tunnels
        const hasLeft = grid.isEmpty(gx - 1, gy);
        const hasRight = grid.isEmpty(gx + 1, gy);
        const hasUp = grid.isEmpty(gx, gy - 1);
        const hasDown = grid.isEmpty(gx, gy + 1);

        // Prefer horizontal movement if horizontal tunnel
        if (hasLeft || hasRight) {
            this.direction = hasRight ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        }
        // Otherwise use vertical movement
        else if (hasUp || hasDown) {
            this.direction = hasDown ? DIRECTIONS.DOWN : DIRECTIONS.UP;
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
