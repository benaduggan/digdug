import { TILE_SIZE, PLAYER, DIRECTIONS } from '../utils/constants.js';

export class Player {
    constructor(grid) {
        this.grid = grid;

        // Position (start at center)
        const centerX = Math.floor(grid.width / 2);
        const centerY = Math.floor(grid.height / 2);
        this.x = TILE_SIZE * centerX;
        this.y = TILE_SIZE * centerY;

        // Movement
        this.speed = PLAYER.SPEED;
        this.direction = DIRECTIONS.LEFT;
        this.previousDirection = DIRECTIONS.LEFT;
        this.isMoving = false;

        // Pump attack
        this.isPumping = false;
        this.pumpTarget = null;
        this.pumpStartTime = 0;

        // Animation
        this.animationFrame = 0;
        this.animationTimer = 0;

        // Sprite orientation tracking for UP/DOWN transitions
        this.spriteFlipH = false;
        this.spriteFlipV = false;

        // Track if player is digging (in contact with dirt)
        this.isDigging = false;
    }

    /**
     * Update player state
     */
    update(deltaTime, inputManager, grid) {
        // Get input direction
        const inputDirection = inputManager.getDirection();

        if (inputDirection) {
            // Track previous direction before changing
            if (inputDirection !== this.direction) {
                this.previousDirection = this.direction;
                this.updateSpriteOrientation(inputDirection);
            }
            this.direction = inputDirection;
            this.isMoving = true;
            this.move(inputDirection, grid);
        } else {
            this.isMoving = false;
        }

        // Handle pump attack
        if (inputManager.isSpacePressed() && !this.isPumping) {
            this.startPump();
        }

        // Update pump state
        if (this.isPumping) {
            this.updatePump(deltaTime);
        }

        // Update animation
        if (this.isMoving) {
            this.animationTimer += deltaTime;
            if (this.animationTimer > 100) {
                this.animationFrame = (this.animationFrame + 1) % 2;
                this.animationTimer = 0;
            }
        }

        // Check if player is in contact with dirt
        this.checkDiggingState(grid);

        // Dig dirt at current position
        this.dig(grid);
    }

    /**
     * Move player in direction
     */
    move(direction, grid) {
        let newX = this.x;
        let newY = this.y;

        switch (direction) {
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

        // Check boundaries
        if (newX < 0) newX = 0;
        if (newX > grid.width * TILE_SIZE - TILE_SIZE) {
            newX = grid.width * TILE_SIZE - TILE_SIZE;
        }
        if (newY < 0) newY = 0;
        if (newY > grid.height * TILE_SIZE - TILE_SIZE) {
            newY = grid.height * TILE_SIZE - TILE_SIZE;
        }

        // Dig the tile we're about to move into BEFORE moving
        const newCenterX = newX + TILE_SIZE / 2;
        const newCenterY = newY + TILE_SIZE / 2;
        const newTile = grid.pixelToGrid(newCenterX, newCenterY);
        grid.dig(newTile.x, newTile.y);

        // Can only move through tunnels (empty tiles) or dig through dirt
        // Check all corners of player hitbox
        const canMove = this.canMoveToPosition(newX, newY, grid);

        if (canMove) {
            this.x = newX;
            this.y = newY;

            // Snap to grid alignment to stay centered in tunnel
            // When moving horizontally, align vertically to grid
            if (
                direction === DIRECTIONS.LEFT ||
                direction === DIRECTIONS.RIGHT
            ) {
                const centerY = this.y + TILE_SIZE / 2;
                const gridY = Math.floor(centerY / TILE_SIZE);
                const targetY = gridY * TILE_SIZE;
                // Gradually snap to grid
                const diff = targetY - this.y;
                if (Math.abs(diff) > 0) {
                    this.y +=
                        Math.sign(diff) * Math.min(Math.abs(diff), this.speed);
                }
            }

            // When moving vertically, align horizontally to grid
            if (direction === DIRECTIONS.UP || direction === DIRECTIONS.DOWN) {
                const centerX = this.x + TILE_SIZE / 2;
                const gridX = Math.floor(centerX / TILE_SIZE);
                const targetX = gridX * TILE_SIZE;
                // Gradually snap to grid
                const diff = targetX - this.x;
                if (Math.abs(diff) > 0) {
                    this.x +=
                        Math.sign(diff) * Math.min(Math.abs(diff), this.speed);
                }
            }
        }
    }

    /**
     * Check if player can move to position
     */
    canMoveToPosition(x, y, grid) {
        const corners = [
            { x: x, y: y },
            { x: x + TILE_SIZE - 1, y: y },
            { x: x, y: y + TILE_SIZE - 1 },
            { x: x + TILE_SIZE - 1, y: y + TILE_SIZE - 1 },
        ];

        // Player can move through empty tiles or dirt (will dig)
        return corners.every((corner) => {
            const { x: gx, y: gy } = grid.pixelToGrid(corner.x, corner.y);
            // Cannot move through rocks
            return !grid.isRock(gx, gy);
        });
    }

    /**
     * Check if player is in contact with dirt (digging state)
     */
    checkDiggingState(grid) {
        // Check tiles around the player based on movement direction
        const centerX = this.x + TILE_SIZE / 2;
        const centerY = this.y + TILE_SIZE / 2;
        const { x: gridX, y: gridY } = grid.pixelToGrid(centerX, centerY);

        // Check adjacent tiles in the direction of movement
        let isInContactWithDirt = false;

        switch (this.direction) {
            case DIRECTIONS.LEFT:
                isInContactWithDirt = grid.isDirt(gridX - 1, gridY);
                break;
            case DIRECTIONS.RIGHT:
                isInContactWithDirt = grid.isDirt(gridX + 1, gridY);
                break;
            case DIRECTIONS.UP:
                isInContactWithDirt = grid.isDirt(gridX, gridY - 1);
                break;
            case DIRECTIONS.DOWN:
                isInContactWithDirt = grid.isDirt(gridX, gridY + 1);
                break;
        }

        this.isDigging = isInContactWithDirt;
    }

    /**
     * Dig dirt at current position
     */
    dig(grid) {
        // Use player's center point to determine which tile to dig
        // This ensures only one tile is dug at a time
        const centerX = this.x + TILE_SIZE / 2;
        const centerY = this.y + TILE_SIZE / 2;
        const { x, y } = grid.pixelToGrid(centerX, centerY);

        // Dig the tile the player's center is in
        grid.dig(x, y);
    }

    /**
     * Update sprite orientation based on direction change
     */
    updateSpriteOrientation(newDirection) {
        if (
            newDirection === DIRECTIONS.LEFT ||
            newDirection === DIRECTIONS.RIGHT
        ) {
            // Horizontal movement
            if (newDirection === DIRECTIONS.RIGHT) {
                this.spriteFlipH = true;
                this.spriteFlipV = false;
            } else {
                this.spriteFlipH = false;
                this.spriteFlipV = false;
            }
        } else if (newDirection === DIRECTIONS.DOWN) {
            // Moving DOWN
            if (this.previousDirection === DIRECTIONS.RIGHT) {
                // From RIGHT: flip horizontally
                this.spriteFlipH = true;
                this.spriteFlipV = false;
            } else if (this.previousDirection === DIRECTIONS.UP) {
                // From UP: flip vertically from current orientation
                // Keep H as it was, invert V
                this.spriteFlipV = !this.spriteFlipV;
            } else if (this.previousDirection === DIRECTIONS.LEFT) {
                // From LEFT: no transformation needed
                this.spriteFlipH = false;
                this.spriteFlipV = false;
            }
        } else if (newDirection === DIRECTIONS.UP) {
            // Moving UP
            if (this.previousDirection === DIRECTIONS.LEFT) {
                // From LEFT: flip both horizontally and vertically
                this.spriteFlipH = true;
                this.spriteFlipV = true;
            } else if (this.previousDirection === DIRECTIONS.RIGHT) {
                // From RIGHT: flip vertically only
                this.spriteFlipH = false;
                this.spriteFlipV = true;
            } else if (this.previousDirection === DIRECTIONS.DOWN) {
                // From DOWN: flip vertically from current orientation
                // Keep H as it was, invert V
                this.spriteFlipV = !this.spriteFlipV;
            }
        }
    }

    /**
     * Start pumping attack
     */
    startPump() {
        this.isPumping = true;
        this.pumpStartTime = Date.now();
    }

    /**
     * Update pump state
     */
    updatePump(deltaTime) {
        const pumpDuration = 500; // ms

        if (Date.now() - this.pumpStartTime > pumpDuration) {
            this.stopPump();
        }
    }

    /**
     * Stop pumping
     */
    stopPump() {
        this.isPumping = false;
        this.pumpTarget = null;
    }

    /**
     * Get grid position
     */
    getGridPosition() {
        return this.grid.pixelToGrid(this.x, this.y);
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
