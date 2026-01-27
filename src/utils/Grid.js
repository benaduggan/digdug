import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES, TILE_SIZE } from './constants.js';

export class Grid {
    constructor() {
        this.width = GRID_WIDTH;
        this.height = GRID_HEIGHT;
        this.tiles = [];
        this.init();
    }

    /**
     * Initialize grid with all tiles as dirt
     */
    init() {
        this.tiles = [];
        for (let y = 0; y < this.height; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                if (y <= 1) this.tiles[y][x] = TILE_TYPES.EMPTY;
                else this.tiles[y][x] = TILE_TYPES.DIRT;
            }
        }
    }

    /**
     * Get tile type at grid position
     */
    getTile(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return TILE_TYPES.DIRT; // Out of bounds treated as dirt
        }
        return this.tiles[y][x];
    }

    /**
     * Set tile type at grid position
     */
    setTile(x, y, type) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.tiles[y][x] = type;
        }
    }

    /**
     * Check if tile is empty (tunnel)
     */
    isEmpty(x, y) {
        return this.getTile(x, y) === TILE_TYPES.EMPTY;
    }

    /**
     * Check if tile is dirt
     */
    isDirt(x, y) {
        return this.getTile(x, y) === TILE_TYPES.DIRT;
    }

    /**
     * Check if tile is a rock
     */
    isRock(x, y) {
        return this.getTile(x, y) === TILE_TYPES.ROCK;
    }

    /**
     * Dig (remove dirt) at grid position
     */
    dig(x, y) {
        if (this.isDirt(x, y)) {
            this.setTile(x, y, TILE_TYPES.EMPTY);
            return true;
        }
        return false;
    }

    /**
     * Convert pixel coordinates to grid coordinates
     */
    pixelToGrid(px, py) {
        return {
            x: Math.floor(px / TILE_SIZE),
            y: Math.floor(py / TILE_SIZE),
        };
    }

    /**
     * Convert grid coordinates to pixel coordinates (top-left of tile)
     */
    gridToPixel(gx, gy) {
        return {
            x: gx * TILE_SIZE,
            y: gy * TILE_SIZE,
        };
    }

    /**
     * Get center pixel position of a grid tile
     */
    gridToPixelCenter(gx, gy) {
        return {
            x: gx * TILE_SIZE + TILE_SIZE / 2,
            y: gy * TILE_SIZE + TILE_SIZE / 2,
        };
    }

    /**
     * Check if position (in pixels) is walkable
     */
    isWalkable(px, py) {
        const { x, y } = this.pixelToGrid(px, py);
        return this.isEmpty(x, y);
    }

    /**
     * Check if entity can move in a direction
     */
    canMove(px, py, direction, entitySize = TILE_SIZE) {
        let newX = px;
        let newY = py;

        switch (direction) {
            case 'up':
                newY -= 1;
                break;
            case 'down':
                newY += 1;
                break;
            case 'left':
                newX -= 1;
                break;
            case 'right':
                newX += 1;
                break;
        }

        // Check all corners of the entity
        const corners = [
            { x: newX, y: newY },
            { x: newX + entitySize - 1, y: newY },
            { x: newX, y: newY + entitySize - 1 },
            { x: newX + entitySize - 1, y: newY + entitySize - 1 },
        ];

        // All corners must be walkable or allow ghosting through dirt
        return corners.every((corner) => {
            const { x, y } = this.pixelToGrid(corner.x, corner.y);
            return x >= 0 && x < this.width && y >= 0 && y < this.height;
        });
    }

    /**
     * Clear a horizontal tunnel
     */
    clearHorizontalTunnel(startX, endX, y) {
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        for (let x = minX; x <= maxX; x++) {
            this.setTile(x, y, TILE_TYPES.EMPTY);
        }
    }

    /**
     * Clear a vertical tunnel
     */
    clearVerticalTunnel(x, startY, endY) {
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);
        for (let y = minY; y <= maxY; y++) {
            this.setTile(x, y, TILE_TYPES.EMPTY);
        }
    }

    /**
     * Place a rock at grid position
     */
    placeRock(x, y) {
        this.setTile(x, y, TILE_TYPES.ROCK);
    }

    /**
     * Remove rock at grid position
     */
    removeRock(x, y) {
        if (this.isRock(x, y)) {
            this.setTile(x, y, TILE_TYPES.EMPTY);
        }
    }

    /**
     * Get all rock positions
     */
    getRockPositions() {
        const rocks = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.isRock(x, y)) {
                    rocks.push({ x, y });
                }
            }
        }
        return rocks;
    }

    /**
     * Check if there's dirt below a position
     */
    hasDirtBelow(x, y) {
        return this.isDirt(x, y + 1);
    }

    /**
     * Reset the grid
     */
    reset() {
        this.init();
    }
}
