import {
    TILE_SIZE,
    DIRECTIONS,
    ENEMY,
    ENEMY_TYPES,
} from '../utils/constants.js';

/**
 * Enemy class - Refactored for cleaner, more maintainable behavior
 * Phase 2: Tunnel movement with player tracking
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

        // AI state
        this.state = 'roaming'; // 'roaming' or 'chasing'
        this.stateTimer = 0;
        this.directionChangeTimer = 0;

        // Track last grid position to detect when we enter a new tile
        this.lastGridX = -1;
        this.lastGridY = -1;

        // Track the previous tile to prevent immediately returning to it
        this.prevGridX = -1;
        this.prevGridY = -1;

        // Track tiles traveled in current direction to prevent oscillation
        this.tilesTraveledInDirection = 0;
        this.minTilesBeforeReverse = 2; // Must travel at least 2 tiles before reversing

        // Animation
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.spriteFlipH = false;

        // Inflation (when pumped)
        this.isInflating = false;
        this.inflateLevel = 1.0;
        this.inflateTimer = 0;

        // Destruction flag
        this.isDestroyed = false;

        // Distance from player (for scoring)
        this.distanceFromPlayer = 0;

        // Ghost mode state (Phase 4)
        this.ghostModeTimer = 0;
        this.canGhostMode = false;
        this.isGhosting = false;
        this.ghostingDuration = 0; // How long we've been ghosting
        // Ghost mode delay: minimum 5 seconds, plus 0-2 extra seconds in 1-second increments
        this.GHOST_MODE_DELAY =
            type === ENEMY_TYPES.POOKA
                ? ENEMY.POOKA.GHOST_MODE_DELAY()
                : ENEMY.FYGAR.GHOST_MODE_DELAY;
        this.MIN_GHOST_DURATION = ENEMY.MIN_GHOST_DURATION;

        // Track previous tile state for dirt-to-tunnel detection
        this.wasInDirt = false;
    }

    /**
     * Update enemy state
     */
    update(deltaTime, player, grid) {
        // Initialize direction on first update if needed
        if (!this.directionInitialized) {
            this.initializeDirection(grid);
            this.directionInitialized = true;
            // Initialize last grid position
            const { x: gx, y: gy } = grid.pixelToGrid(
                this.x + TILE_SIZE / 2,
                this.y + TILE_SIZE / 2
            );
            this.lastGridX = gx;
            this.lastGridY = gy;
        }

        // Update inflation state (handles both inflating and deflating)
        if (this.isInflating || this.inflateLevel > 1.0) {
            this.updateInflation(deltaTime);
        }

        // Update AI state based on player distance
        if (player) {
            this.updateAI(deltaTime, player, grid);
        }

        // Update ghost mode timer and detect tunnel transitions (after AI so state is current)
        this.updateGhostMode(deltaTime, player, grid);

        // Move enemy
        if (this.isMoving && !this.isInflating) {
            this.move(grid, player);
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
     * Update ghost mode state - timer, activation, and deactivation
     */
    updateGhostMode(deltaTime, player, grid) {
        // Get current tile state
        const { x: gx, y: gy } = grid.pixelToGrid(
            this.x + TILE_SIZE / 2,
            this.y + TILE_SIZE / 2
        );
        const currentlyInTunnel = grid.isEmpty(gx, gy);
        const currentlyInDirt = !currentlyInTunnel && !grid.isRock(gx, gy);

        // Track how long we've been ghosting
        if (this.isGhosting) {
            this.ghostingDuration += deltaTime;
        }

        // Exit ghost mode if in a tunnel and min duration elapsed
        // This handles both dirt-to-tunnel transitions AND ghosts traveling through existing tunnels
        if (
            this.isGhosting &&
            currentlyInTunnel &&
            this.ghostingDuration >= this.MIN_GHOST_DURATION
        ) {
            // Reset ghost mode when in tunnel after min duration
            this.ghostModeTimer = 0;
            this.canGhostMode = false;
            this.isGhosting = false;
            this.ghostingDuration = 0;
        }

        // Update previous state for next frame
        this.wasInDirt = currentlyInDirt;

        // Increment timer (always, when not currently ghosting)
        if (!this.isGhosting) {
            this.ghostModeTimer += deltaTime;

            // After delay, ghost mode becomes available
            if (this.ghostModeTimer >= this.GHOST_MODE_DELAY) {
                this.canGhostMode = true;
            }
        }

        // Ghost mode activation - when timer elapsed (regardless of AI state)
        if (this.canGhostMode && !this.isGhosting && player) {
            // Activate ghost mode to take direct path to player
            this.isGhosting = true;
            this.ghostingDuration = 0;
        }
    }

    /**
     * Update AI behavior
     */
    updateAI(deltaTime, player, grid) {
        // Calculate distance to player
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

        // State transitions based on distance
        // Chase when player is within 8 tiles (~half the grid width)
        // Roam when player is beyond 10 tiles
        const CHASE_DISTANCE = TILE_SIZE * 8;
        const ROAM_DISTANCE = TILE_SIZE * 10;

        if (distanceToPlayer <= CHASE_DISTANCE && this.state !== 'chasing') {
            this.state = 'chasing';
            this.stateTimer = 0;
        } else if (
            distanceToPlayer > ROAM_DISTANCE &&
            this.state !== 'roaming'
        ) {
            this.state = 'roaming';
            this.stateTimer = 0;
        }

        // Update timers
        this.stateTimer += deltaTime;
        this.directionChangeTimer += deltaTime;
    }

    /**
     * Move enemy through tunnels (or through dirt when ghosting)
     */
    move(grid, player = null) {
        // If ghosting, use ghost movement logic
        if (this.isGhosting && player) {
            this.moveGhost(grid, player);
            return;
        }

        // Get current grid position
        const centerX = this.x + TILE_SIZE / 2;
        const centerY = this.y + TILE_SIZE / 2;
        const { x: gx, y: gy } = grid.pixelToGrid(centerX, centerY);

        // Check if we've moved to a new grid cell
        const enteredNewTile = gx !== this.lastGridX || gy !== this.lastGridY;

        // When entering a new tile, consider changing direction
        if (enteredNewTile) {
            // Remember the tile we came from
            this.prevGridX = this.lastGridX;
            this.prevGridY = this.lastGridY;
            this.lastGridX = gx;
            this.lastGridY = gy;
            this.tilesTraveledInDirection++;

            // At a new tile, decide direction based on AI state
            if (player && this.state === 'chasing') {
                this.decideDirectionAtTile(player, grid, gx, gy);
            } else if (this.state === 'roaming') {
                this.roamAtTile(grid, gx, gy);
            }
        } else if (player && this.state === 'chasing') {
            // Even if we didn't enter a new tile, check if we should turn
            // This handles the case where we're passing through an intersection
            // and need to turn toward the player
            this.checkForBetterDirection(player, grid, gx, gy);
        }

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
                if (this.spriteFlipH) this.spriteFlipH = false;
                break;
            case DIRECTIONS.RIGHT:
                newX += this.speed;
                if (!this.spriteFlipH) this.spriteFlipH = true;
                break;
        }

        // Check if can move to new position (leading edge check)
        const canMove = this.canMoveInDirection(
            newX,
            newY,
            this.direction,
            grid
        );

        if (canMove) {
            // Move to new position
            this.x = newX;
            this.y = newY;

            // Apply grid snapping for tunnel centering
            this.applyGridSnapping(grid);
        } else {
            // Hit a wall, snap to grid and pick new direction
            this.snapToGrid(grid);
            this.pickValidDirection(grid, player, gx, gy);
            this.tilesTraveledInDirection = 0; // Reset counter when forced to change direction
        }
    }

    /**
     * Ghost mode movement - move directly toward player through dirt
     * Uses subclass ghostSpeed if defined, otherwise 80% of base speed
     */
    moveGhost(grid, player) {
        // Use subclass-specific ghostSpeed if available (Pooka/Fygar have different speeds)
        const ghostSpeed = this.ghostSpeed || this.speed * 0.8;

        // Calculate direction toward player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If very close to player, just use cardinal direction
        if (distance < 2) {
            return;
        }

        // Normalize direction and calculate movement
        const normalizedDx = dx / distance;
        const normalizedDy = dy / distance;

        // Calculate desired movement
        const moveX = normalizedDx * ghostSpeed;
        const moveY = normalizedDy * ghostSpeed;

        // Try diagonal movement first (both axes)
        const newX = this.x + moveX;
        const newY = this.y + moveY;

        // Determine the visual direction based on primary axis
        let newDirection;
        if (Math.abs(dx) > Math.abs(dy)) {
            newDirection = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        } else {
            newDirection = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        }

        // Check if we can move diagonally (check both the X and Y destinations)
        const canMoveX = this.canGhostMoveToPosition(
            this.x + moveX,
            this.y,
            grid
        );
        const canMoveY = this.canGhostMoveToPosition(
            this.x,
            this.y + moveY,
            grid
        );

        if (canMoveX && canMoveY) {
            // Full diagonal movement
            this.x = newX;
            this.y = newY;
            this.direction = newDirection;
            return;
        }

        // Try X movement only
        if (canMoveX) {
            this.x = this.x + moveX;
            this.direction = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            return;
        }

        // Try Y movement only
        if (canMoveY) {
            this.y = this.y + moveY;
            this.direction = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            return;
        }

        // Both blocked by rock - choose perpendicular direction that gets us closer to player
        // Determine which perpendicular directions to try based on player position
        let perpDirs = [];
        if (Math.abs(dx) > Math.abs(dy)) {
            // Primarily blocked horizontally, try vertical movement
            // Prefer the vertical direction toward the player
            if (dy > 0) {
                perpDirs = [DIRECTIONS.DOWN, DIRECTIONS.UP];
            } else {
                perpDirs = [DIRECTIONS.UP, DIRECTIONS.DOWN];
            }
        } else {
            // Primarily blocked vertically, try horizontal movement
            // Prefer the horizontal direction toward the player
            if (dx > 0) {
                perpDirs = [DIRECTIONS.RIGHT, DIRECTIONS.LEFT];
            } else {
                perpDirs = [DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
            }
        }

        for (const dir of perpDirs) {
            const newPos = this.getNewPosition(this.x, this.y, dir, ghostSpeed);
            if (this.canGhostMoveToPosition(newPos.x, newPos.y, grid)) {
                this.x = newPos.x;
                this.y = newPos.y;
                this.direction = dir;
                return;
            }
        }

        // Still stuck - try all four directions as last resort
        const allDirs = [
            DIRECTIONS.UP,
            DIRECTIONS.DOWN,
            DIRECTIONS.LEFT,
            DIRECTIONS.RIGHT,
        ];
        for (const dir of allDirs) {
            const newPos = this.getNewPosition(this.x, this.y, dir, ghostSpeed);
            if (this.canGhostMoveToPosition(newPos.x, newPos.y, grid)) {
                this.x = newPos.x;
                this.y = newPos.y;
                this.direction = dir;
                return;
            }
        }

        // Completely stuck (surrounded by rocks) - stay in place
    }

    /**
     * Check if ghost can move to position (only rocks and sky block)
     */
    canGhostMoveToPosition(x, y, grid) {
        // Check center point
        const { x: gx, y: gy } = grid.pixelToGrid(
            x + TILE_SIZE / 2,
            y + TILE_SIZE / 2
        );
        // Top row (sky) is always blocked
        if (gy === 0) {
            return false;
        }
        return !grid.isRock(gx, gy);
    }

    /**
     * Get perpendicular direction for rock avoidance
     */
    getPerpendicularDirection(dir, clockwise) {
        if (clockwise) {
            switch (dir) {
                case DIRECTIONS.UP:
                    return DIRECTIONS.RIGHT;
                case DIRECTIONS.RIGHT:
                    return DIRECTIONS.DOWN;
                case DIRECTIONS.DOWN:
                    return DIRECTIONS.LEFT;
                case DIRECTIONS.LEFT:
                    return DIRECTIONS.UP;
            }
        } else {
            switch (dir) {
                case DIRECTIONS.UP:
                    return DIRECTIONS.LEFT;
                case DIRECTIONS.LEFT:
                    return DIRECTIONS.DOWN;
                case DIRECTIONS.DOWN:
                    return DIRECTIONS.RIGHT;
                case DIRECTIONS.RIGHT:
                    return DIRECTIONS.UP;
            }
        }
        return dir;
    }

    /**
     * Calculate new position given direction and speed
     */
    getNewPosition(x, y, direction, speed) {
        let newX = x;
        let newY = y;

        switch (direction) {
            case DIRECTIONS.UP:
                newY -= speed;
                break;
            case DIRECTIONS.DOWN:
                newY += speed;
                break;
            case DIRECTIONS.LEFT:
                newX -= speed;
                break;
            case DIRECTIONS.RIGHT:
                newX += speed;
                break;
        }

        return { x: newX, y: newY };
    }

    /**
     * Check if there's a better direction toward the player while passing through a tile
     * Only triggers at intersections (3+ valid directions)
     */
    checkForBetterDirection(player, grid, gx, gy) {
        // Get valid directions FIRST
        const validDirections = this.getValidDirectionsFromTile(grid, gx, gy);

        // Only consider turns at actual intersections (3+ directions)
        // This prevents turning in straight tunnels or corners
        if (validDirections.length < 3) {
            return;
        }

        // If current direction is not valid, don't try to change - let canMoveInDirection handle it
        if (!validDirections.includes(this.direction)) {
            return;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;

        // Determine preferred direction toward player
        let preferredDirection;
        if (Math.abs(dx) > Math.abs(dy)) {
            preferredDirection = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        } else {
            preferredDirection = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        }

        // If we're already going the preferred direction, no change needed
        if (this.direction === preferredDirection) {
            return;
        }

        // Check if preferred direction is actually valid (has a tunnel)
        if (!validDirections.includes(preferredDirection)) {
            return; // Can't turn toward player from this intersection
        }

        // Check if turning would be a perpendicular turn
        const isCurrentHorizontal =
            this.direction === DIRECTIONS.LEFT ||
            this.direction === DIRECTIONS.RIGHT;
        const isPreferredHorizontal =
            preferredDirection === DIRECTIONS.LEFT ||
            preferredDirection === DIRECTIONS.RIGHT;
        const isPerpendicular = isCurrentHorizontal !== isPreferredHorizontal;

        // Calculate alignment - must be very close to tile center
        const tileCenterX = gx * TILE_SIZE;
        const tileCenterY = gy * TILE_SIZE;

        if (isPerpendicular) {
            // For perpendicular turns, must be perfectly aligned with tile center
            let alignmentError;
            if (isCurrentHorizontal) {
                alignmentError = Math.abs(this.x - tileCenterX);
            } else {
                alignmentError = Math.abs(this.y - tileCenterY);
            }
            // Very tight tolerance - only turn when essentially at tile center
            const tolerance = this.speed;

            if (alignmentError <= tolerance) {
                this.direction = preferredDirection;
                this.tilesTraveledInDirection = 0;
                // Snap BOTH axes to tile position for clean turn
                this.x = tileCenterX;
                this.y = tileCenterY;
            }
        } else {
            // Non-perpendicular (reversal) - only allow if we've traveled enough tiles
            if (this.tilesTraveledInDirection >= this.minTilesBeforeReverse) {
                this.direction = preferredDirection;
                this.tilesTraveledInDirection = 0;
            }
        }
    }

    /**
     * Decide which direction to go when entering a new tile (chasing mode)
     */
    decideDirectionAtTile(player, grid, gx, gy) {
        // Get valid tunnel directions from this tile FIRST
        const validDirections = this.getValidDirectionsFromTile(grid, gx, gy);

        // If no valid directions, keep current (will be handled by wall collision)
        if (validDirections.length === 0) {
            return;
        }

        // If only one valid direction (dead end), don't change direction yet.
        // Let the enemy keep moving until it hits the wall, then it will turn around
        // via pickValidDirection. This makes enemies walk to the end of tunnels.
        if (validDirections.length === 1) {
            return;
        }

        // KEY INSIGHT: Only make decisions at intersections (3+ directions)
        // or when current direction is invalid
        // In a straight tunnel (2 directions), just keep going
        const currentIsValid = validDirections.includes(this.direction);
        const oppositeDirection = this.getOppositeDirection(this.direction);

        if (validDirections.length === 2 && currentIsValid) {
            // In a straight tunnel or corner - just keep going unless blocked
            return;
        }

        // At an intersection (3+ directions) or current direction invalid
        // Now we can make a smart decision

        // Filter out dead-end directions (1-tile stubs)
        const viableDirections = validDirections.filter((d) =>
            this.isViableDirection(grid, gx, gy, d)
        );

        // Also filter out the direction that leads back to the previous tile
        // This prevents oscillation between two tiles
        const directionToPrevTile = this.getDirectionToTile(
            gx,
            gy,
            this.prevGridX,
            this.prevGridY
        );
        const nonBacktrackDirections = viableDirections.filter(
            (d) => d !== directionToPrevTile
        );

        // Use non-backtracking directions if available, otherwise fall back to viable, then valid
        const directionsToConsider =
            nonBacktrackDirections.length > 0
                ? nonBacktrackDirections
                : viableDirections.length > 0
                  ? viableDirections
                  : validDirections;

        const dx = player.x - this.x;
        const dy = player.y - this.y;

        // Determine preferred directions based on player position
        let primaryDirection, secondaryDirection;

        if (Math.abs(dx) > Math.abs(dy)) {
            primaryDirection = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            secondaryDirection = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        } else {
            primaryDirection = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            secondaryDirection = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        }

        // Try primary direction first (if viable)
        if (directionsToConsider.includes(primaryDirection)) {
            this.direction = primaryDirection;
            return;
        }

        // Try secondary direction (if viable)
        if (directionsToConsider.includes(secondaryDirection)) {
            this.direction = secondaryDirection;
            return;
        }

        // Keep current direction if still viable
        if (directionsToConsider.includes(this.direction)) {
            return;
        }

        // Pick any direction that isn't reversing
        const nonReverseDirections = directionsToConsider.filter(
            (d) => d !== oppositeDirection
        );
        if (nonReverseDirections.length > 0) {
            this.direction = nonReverseDirections[0];
        } else if (directionsToConsider.length > 0) {
            this.direction = directionsToConsider[0];
        }
    }

    /**
     * Get the direction from one tile to an adjacent tile
     * Returns null if tiles are not adjacent or are the same
     */
    getDirectionToTile(fromGx, fromGy, toGx, toGy) {
        const dx = toGx - fromGx;
        const dy = toGy - fromGy;

        if (dx === 1 && dy === 0) return DIRECTIONS.RIGHT;
        if (dx === -1 && dy === 0) return DIRECTIONS.LEFT;
        if (dx === 0 && dy === 1) return DIRECTIONS.DOWN;
        if (dx === 0 && dy === -1) return DIRECTIONS.UP;
        return null;
    }

    /**
     * Get the opposite direction
     */
    getOppositeDirection(direction) {
        switch (direction) {
            case DIRECTIONS.UP:
                return DIRECTIONS.DOWN;
            case DIRECTIONS.DOWN:
                return DIRECTIONS.UP;
            case DIRECTIONS.LEFT:
                return DIRECTIONS.RIGHT;
            case DIRECTIONS.RIGHT:
                return DIRECTIONS.LEFT;
            default:
                return direction;
        }
    }

    /**
     * Check if a direction leads to a dead end within 5 tiles
     * Returns true if direction is viable (leads somewhere useful)
     */
    isViableDirection(grid, gx, gy, direction) {
        const maxDepth = 5;
        let currentGx = gx;
        let currentGy = gy;
        let currentDir = direction;

        for (let depth = 0; depth < maxDepth; depth++) {
            // Move to next tile in current direction
            let nextGx = currentGx;
            let nextGy = currentGy;

            switch (currentDir) {
                case DIRECTIONS.UP:
                    nextGy--;
                    break;
                case DIRECTIONS.DOWN:
                    nextGy++;
                    break;
                case DIRECTIONS.LEFT:
                    nextGx--;
                    break;
                case DIRECTIONS.RIGHT:
                    nextGx++;
                    break;
            }

            // Check if next tile is valid
            if (!grid.isEmpty(nextGx, nextGy) || grid.isRock(nextGx, nextGy)) {
                // Hit a wall - this path is a dead end
                return false;
            }

            // Check exits from this tile (excluding the way we came)
            const oppositeDir = this.getOppositeDirection(currentDir);
            const tileDirections = this.getValidDirectionsFromTile(
                grid,
                nextGx,
                nextGy
            );
            const exits = tileDirections.filter((d) => d !== oppositeDir);

            // If there are multiple exits, this is an intersection - path is viable
            if (exits.length > 1) {
                return true;
            }

            // If there's exactly one exit, continue down that path
            if (exits.length === 1) {
                currentGx = nextGx;
                currentGy = nextGy;
                currentDir = exits[0];
                continue;
            }

            // No exits (other than back) - dead end
            return false;
        }

        // Reached max depth without finding dead end or intersection
        // Consider it viable (path continues beyond our search)
        return true;
    }

    /**
     * Roam behavior when entering a new tile
     */
    roamAtTile(grid, gx, gy) {
        const validDirections = this.getValidDirectionsFromTile(grid, gx, gy);

        if (validDirections.length === 0) return;

        // If only one direction (dead end), don't change direction yet.
        // Let the enemy keep moving until it hits the wall, then it will turn around.
        if (validDirections.length === 1) {
            return;
        }

        // Filter out direction back to previous tile to avoid oscillation
        const directionToPrevTile = this.getDirectionToTile(
            gx,
            gy,
            this.prevGridX,
            this.prevGridY
        );
        const forwardDirections = validDirections.filter(
            (d) => d !== directionToPrevTile
        );

        // Use forward directions if available
        const directionsToConsider =
            forwardDirections.length > 0 ? forwardDirections : validDirections;

        // Only change direction occasionally, unless current direction is invalid
        const currentIsValid = directionsToConsider.includes(this.direction);
        if (
            currentIsValid &&
            this.directionChangeTimer < 1000 + Math.random() * 1000
        ) {
            return;
        }
        this.directionChangeTimer = 0;

        if (directionsToConsider.length > 0) {
            this.direction =
                directionsToConsider[
                    Math.floor(Math.random() * directionsToConsider.length)
                ];
        }
    }

    /**
     * Get valid directions (tunnel tiles) from a specific grid position
     */
    getValidDirectionsFromTile(grid, gx, gy) {
        const validDirections = [];

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

        return validDirections;
    }

    /**
     * Check if enemy can move in a direction (leading edge collision check)
     */
    canMoveInDirection(x, y, direction, grid) {
        // Check the leading edge based on movement direction
        let checkX, checkY;

        switch (direction) {
            case DIRECTIONS.UP:
                checkX = x + TILE_SIZE / 2;
                checkY = y;
                break;
            case DIRECTIONS.DOWN:
                checkX = x + TILE_SIZE / 2;
                checkY = y + TILE_SIZE - 1;
                break;
            case DIRECTIONS.LEFT:
                checkX = x;
                checkY = y + TILE_SIZE / 2;
                break;
            case DIRECTIONS.RIGHT:
                checkX = x + TILE_SIZE - 1;
                checkY = y + TILE_SIZE / 2;
                break;
            default:
                checkX = x + TILE_SIZE / 2;
                checkY = y + TILE_SIZE / 2;
        }

        const { x: gx, y: gy } = grid.pixelToGrid(checkX, checkY);

        // Top row (sky) is always blocked
        if (gy === 0) {
            return false;
        }

        // Rocks always block movement (even when ghosting)
        if (grid.isRock(gx, gy)) {
            return false;
        }

        // When ghosting, can move through dirt
        if (this.isGhosting) {
            return true;
        }

        // Normal mode: cannot move into dirt
        if (!grid.isEmpty(gx, gy)) {
            return false;
        }

        return true;
    }

    /**
     * Snap position to align with grid
     */
    snapToGrid(grid) {
        const centerX = this.x + TILE_SIZE / 2;
        const centerY = this.y + TILE_SIZE / 2;
        const { x: gx, y: gy } = grid.pixelToGrid(centerX, centerY);

        this.x = gx * TILE_SIZE;
        this.y = gy * TILE_SIZE;
    }

    /**
     * Pick a valid direction when hitting a wall
     */
    pickValidDirection(grid, player, gx, gy) {
        const validDirections = this.getValidDirectionsFromTile(grid, gx, gy);

        if (validDirections.length === 0) return;

        // If chasing, prefer direction toward player
        if (player && this.state === 'chasing') {
            const dx = player.x - this.x;
            const dy = player.y - this.y;

            // Determine primary and secondary preferred directions
            let primaryDirection, secondaryDirection;
            if (Math.abs(dx) > Math.abs(dy)) {
                primaryDirection = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
                secondaryDirection = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            } else {
                primaryDirection = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
                secondaryDirection =
                    dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            }

            // Try primary direction first
            if (validDirections.includes(primaryDirection)) {
                this.direction = primaryDirection;
                return;
            }

            // Try secondary direction (helps navigate around obstacles)
            if (validDirections.includes(secondaryDirection)) {
                this.direction = secondaryDirection;
                return;
            }
        }

        // Pick random valid direction
        this.direction =
            validDirections[Math.floor(Math.random() * validDirections.length)];
    }

    /**
     * Apply grid snapping to keep enemy centered in tunnels
     */
    applyGridSnapping(grid) {
        const { x: gx, y: gy } = grid.pixelToGrid(
            this.x + TILE_SIZE / 2,
            this.y + TILE_SIZE / 2
        );

        // Only snap if currently in a tunnel
        if (!grid.isEmpty(gx, gy)) {
            return;
        }

        // When moving horizontally, align vertically to grid center
        if (
            this.direction === DIRECTIONS.LEFT ||
            this.direction === DIRECTIONS.RIGHT
        ) {
            const targetY = gy * TILE_SIZE;
            const diff = targetY - this.y;

            if (Math.abs(diff) > 0) {
                const snapAmount =
                    Math.sign(diff) * Math.min(Math.abs(diff), this.speed);
                this.y += snapAmount;
            }
        }

        // When moving vertically, align horizontally to grid center
        if (
            this.direction === DIRECTIONS.UP ||
            this.direction === DIRECTIONS.DOWN
        ) {
            const targetX = gx * TILE_SIZE;
            const diff = targetX - this.x;

            if (Math.abs(diff) > 0) {
                const snapAmount =
                    Math.sign(diff) * Math.min(Math.abs(diff), this.speed);
                this.x += snapAmount;
            }
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

        const validDirections = this.getValidDirectionsFromTile(grid, gx, gy);

        // Prefer horizontal movement
        if (validDirections.includes(DIRECTIONS.RIGHT)) {
            this.spriteFlipH = true;
        } else if (validDirections.includes(DIRECTIONS.LEFT)) {
            this.direction = DIRECTIONS.LEFT;
        } else if (validDirections.includes(DIRECTIONS.DOWN)) {
            this.direction = DIRECTIONS.DOWN;
        } else if (validDirections.includes(DIRECTIONS.UP)) {
            this.direction = DIRECTIONS.UP;
        }
    }

    /**
     * Start or continue inflation (when pumped)
     */
    startInflation() {
        this.isInflating = true;
        this.isMoving = false;
        this.deflateTimer = 0; // Reset deflate countdown
    }

    /**
     * Stop being pumped - will start deflating
     */
    stopInflation() {
        // Don't immediately stop - let deflation happen in updateInflation
    }

    /**
     * Update inflation state
     * Called every frame - inflates while being pumped, deflates otherwise
     */
    updateInflation(deltaTime) {
        const INFLATE_DURATION = 1200; // 1.2 seconds to full inflation

        if (this.isInflating) {
            // Being actively pumped - inflate
            this.inflateTimer += deltaTime;
            this.inflateLevel = 1.0 + this.inflateTimer / INFLATE_DURATION;

            if (this.inflateLevel >= 2.0) {
                this.pop();
            }
        } else if (this.inflateLevel > 1.0) {
            // Not being pumped - deflate slowly
            this.deflateTimer = (this.deflateTimer || 0) + deltaTime;

            // Start deflating after a short pause
            if (this.deflateTimer > 300) {
                this.inflateTimer = Math.max(
                    0,
                    this.inflateTimer - deltaTime * 0.5
                );
                this.inflateLevel = 1.0 + this.inflateTimer / INFLATE_DURATION;

                if (this.inflateLevel <= 1.0) {
                    // Fully deflated - can move again
                    this.inflateLevel = 1.0;
                    this.inflateTimer = 0;
                    this.isMoving = true;
                }
            }
        }

        // Reset inflating flag - must be set each frame by pump collision
        this.isInflating = false;
    }

    /**
     * Enemy pops (dies)
     */
    pop() {
        this.isDestroyed = true;
    }

    /**
     * Update animation
     */
    updateAnimation(deltaTime) {
        this.animationTimer += deltaTime;
        if (this.animationTimer > 400) {
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

    /**
     * Reset all timers - called when game starts or respawns
     */
    resetTimers() {
        this.ghostModeTimer = 0;
        this.canGhostMode = false;
        this.isGhosting = false;
        this.ghostingDuration = 0;
        this.stateTimer = 0;
        this.directionChangeTimer = 0;
        // Reset inflation state
        this.inflateTimer = 0;
        this.inflateLevel = 1.0;
        this.isInflating = false;
        this.deflateTimer = 0;
        this.isMoving = true;
    }
}
