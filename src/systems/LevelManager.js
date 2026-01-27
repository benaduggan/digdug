import {
    GRID_WIDTH,
    GRID_HEIGHT,
    TILE_SIZE,
    LEVEL,
    TILE_TYPES,
} from '../utils/constants.js';
import { Pooka } from '../entities/Pooka.js';
import { Fygar } from '../entities/Fygar.js';
import { Rock } from '../entities/Rock.js';

export class LevelManager {
    constructor(grid) {
        this.grid = grid;
        this.currentLevel = 0;
        this.rocks = [];
    }

    /**
     * Generate a procedural level
     */
    generateLevel(levelNumber) {
        this.currentLevel = levelNumber;
        this.grid.reset();
        this.rocks = [];
        this.currentEnemies = []; // Store for rock placement

        // Create initial tunnels
        this.generateTunnels(levelNumber);

        // Note: Rocks will be placed AFTER enemies are spawned
        // See placeRocksAfterEnemies() method
    }

    /**
     * Generate tunnel network
     */
    generateTunnels(levelNumber) {
        // Create a small starting tunnel for the player in the center
        const centerX = Math.floor(GRID_WIDTH / 2);
        const centerY = Math.floor(GRID_HEIGHT / 2);

        // Small 3-tile cross pattern for player start
        this.grid.clearHorizontalTunnel(centerX - 1, centerX + 1, centerY);
        this.grid.clearVerticalTunnel(centerX, centerY - 1, centerY + 1);

        // Store player start tunnel location
        this.playerStartTunnel = { x: centerX, y: centerY };
    }

    /**
     * Place rocks strategically in the level (away from paths and enemies)
     * Called after enemies are spawned
     */
    placeRocksAfterEnemies(levelNumber, enemies) {
        const targetRocks = Math.min(
            LEVEL.ROCKS_PER_LEVEL + Math.floor(levelNumber / 3),
            6
        );
        const minRocks = 3; // Must have at least 3 boulders

        this.rocks = []; // Reset rocks array

        // Try with strict constraints first
        let minRockDistance = 10;
        let minPathDistance = 3;
        let minEnemyDistance = 6;

        for (let i = 0; i < targetRocks; i++) {
            // Find a good position for a rock
            let attempts = 0;
            let placed = false;

            // If we haven't placed minimum rocks and running out of attempts, relax constraints
            while (!placed && attempts < 150) {
                // Relax constraints after many failed attempts
                if (attempts > 50 && this.rocks.length < minRocks) {
                    minPathDistance = 2;
                    minEnemyDistance = 4;
                    minRockDistance = 4;
                }
                if (attempts > 100 && this.rocks.length < minRocks) {
                    minPathDistance = 1;
                    minEnemyDistance = 3;
                    minRockDistance = 3;
                }
                const x = Math.floor(Math.random() * (GRID_WIDTH - 8)) + 4;
                const y = Math.floor(Math.random() * (GRID_HEIGHT - 10)) + 5;

                // Rock position must be dirt
                if (!this.grid.isDirt(x, y)) {
                    attempts++;
                    continue;
                }

                // Check area around rock for paths - rocks should be completely surrounded by dirt
                let tooCloseToPath = false;
                for (let dy = -minPathDistance; dy <= minPathDistance; dy++) {
                    for (
                        let dx = -minPathDistance;
                        dx <= minPathDistance;
                        dx++
                    ) {
                        if (dx === 0 && dy === 0) continue; // Skip rock position itself

                        if (this.grid.isEmpty(x + dx, y + dy)) {
                            tooCloseToPath = true;
                            break;
                        }
                    }
                    if (tooCloseToPath) break;
                }

                if (tooCloseToPath) {
                    attempts++;
                    continue;
                }

                // Check distance from enemies
                const tooCloseToEnemy = enemies.some((enemy) => {
                    const enemyGridX = Math.floor(enemy.x / TILE_SIZE);
                    const enemyGridY = Math.floor(enemy.y / TILE_SIZE);
                    const dx = Math.abs(enemyGridX - x);
                    const dy = Math.abs(enemyGridY - y);
                    return dx < minEnemyDistance && dy < minEnemyDistance;
                });

                if (tooCloseToEnemy) {
                    attempts++;
                    continue;
                }

                // Check distance from existing rocks
                const tooCloseToOtherRock = this.rocks.some((existingRock) => {
                    const dx = Math.abs(existingRock.gridX - x);
                    const dy = Math.abs(existingRock.gridY - y);
                    return dx < minRockDistance && dy < minRockDistance;
                });

                if (!tooCloseToOtherRock) {
                    this.grid.placeRock(x, y);

                    // Create Rock entity
                    const rock = new Rock(
                        x * TILE_SIZE,
                        y * TILE_SIZE,
                        this.grid
                    );
                    this.rocks.push(rock);

                    placed = true;
                }

                attempts++;
            }
        }

        // Ensure we have at least the minimum number of boulders
        // If not, place them with minimal constraints
        if (this.rocks.length < minRocks) {
            const rocksNeeded = minRocks - this.rocks.length;

            for (let i = 0; i < rocksNeeded; i++) {
                let placed = false;
                let attempts = 0;

                while (!placed && attempts < 200) {
                    const x = Math.floor(Math.random() * (GRID_WIDTH - 8)) + 4;
                    const y =
                        Math.floor(Math.random() * (GRID_HEIGHT - 10)) + 5;

                    // Minimal constraints: just needs dirt, not near tunnels
                    if (this.grid.isDirt(x, y)) {
                        // Check not too close to tunnels (at least 1 tile away)
                        let nearTunnel = false;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (this.grid.isEmpty(x + dx, y + dy)) {
                                    nearTunnel = true;
                                    break;
                                }
                            }
                            if (nearTunnel) break;
                        }

                        if (!nearTunnel) {
                            // Check not on top of existing rock
                            const notOnRock = !this.rocks.some(
                                (existingRock) => {
                                    return (
                                        existingRock.gridX === x &&
                                        existingRock.gridY === y
                                    );
                                }
                            );

                            if (notOnRock) {
                                this.grid.placeRock(x, y);
                                const rock = new Rock(
                                    x * TILE_SIZE,
                                    y * TILE_SIZE,
                                    this.grid
                                );
                                this.rocks.push(rock);
                                placed = true;
                            }
                        }
                    }
                    attempts++;
                }
            }
        }
    }

    /**
     * Spawn enemies for the level
     */
    spawnEnemies(levelNumber) {
        const enemies = [];

        // Calculate number of enemies based on level
        const numEnemies = Math.min(
            LEVEL.START_ENEMIES + (levelNumber - 1) * LEVEL.ENEMY_INCREMENT,
            LEVEL.MAX_ENEMIES
        );

        // Calculate Pooka/Fygar ratio (more Fygars in later levels)
        const fygarRatio = Math.min(0.5, 0.2 + levelNumber * 0.05);
        const numFygars = Math.floor(numEnemies * fygarRatio);
        const numPookas = numEnemies - numFygars;

        // Create tunnels for enemies
        this.enemyTunnels = [];
        this.createEnemyTunnels(numEnemies);

        // Spawn Pookas
        for (let i = 0; i < numPookas; i++) {
            const pos = this.getEnemySpawnPosition(i);
            enemies.push(new Pooka(pos.x, pos.y, levelNumber));
        }

        // Spawn Fygars
        for (let i = 0; i < numFygars; i++) {
            const pos = this.getEnemySpawnPosition(numPookas + i);
            enemies.push(new Fygar(pos.x, pos.y, levelNumber));
        }

        return enemies;
    }

    /**
     * Create tunnels for enemies to spawn in
     */
    createEnemyTunnels(numEnemies) {
        const minSpacing = 8; // Minimum tiles between enemy tunnels
        const tunnelLength = Math.floor(Math.random() * 2) + 4; // 4-5 tiles long

        for (let i = 0; i < numEnemies; i++) {
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < 100) {
                // Random position, avoiding center (player area)
                const x = Math.floor(Math.random() * (GRID_WIDTH - 8)) + 4;
                const y = Math.floor(Math.random() * (GRID_HEIGHT - 8)) + 4;

                // Avoid the top 3 rows (sky area + top dirt row)
                if (y < 4) {
                    attempts++;
                    continue;
                }

                // Check distance from player start
                const playerCenterX = Math.floor(GRID_WIDTH / 2);
                const playerCenterY = Math.floor(GRID_HEIGHT / 2);
                const distFromPlayer = Math.sqrt(
                    Math.pow(x - playerCenterX, 2) +
                        Math.pow(y - playerCenterY, 2)
                );

                if (distFromPlayer < 10) {
                    attempts++;
                    continue; // Too close to player
                }

                // Check distance from other enemy tunnels
                const tooClose = this.enemyTunnels.some((tunnel) => {
                    const dist = Math.sqrt(
                        Math.pow(tunnel.x - x, 2) + Math.pow(tunnel.y - y, 2)
                    );
                    return dist < minSpacing;
                });

                if (!tooClose) {
                    // Create tunnel (horizontal or vertical randomly)
                    const horizontal = Math.random() > 0.5;
                    const length = Math.floor(Math.random() * 2) + 4; // 4-5 tiles

                    if (horizontal) {
                        this.grid.clearHorizontalTunnel(
                            x,
                            Math.min(x + length, GRID_WIDTH - 2),
                            y
                        );
                    } else {
                        this.grid.clearVerticalTunnel(
                            x,
                            y,
                            Math.min(y + length, GRID_HEIGHT - 2)
                        );
                    }

                    this.enemyTunnels.push({ x, y, horizontal, length });
                    placed = true;
                }

                attempts++;
            }
        }
    }

    /**
     * Get a valid spawn position for an enemy in their pre-created tunnel
     */
    getEnemySpawnPosition(enemyIndex) {
        // Get the tunnel for this enemy
        if (enemyIndex < this.enemyTunnels.length) {
            const tunnel = this.enemyTunnels[enemyIndex];
            // Spawn in the middle of their tunnel
            const offsetX = tunnel.horizontal
                ? Math.floor(tunnel.length / 2)
                : 0;
            const offsetY = tunnel.horizontal
                ? 0
                : Math.floor(tunnel.length / 2);

            const gridX = tunnel.x + offsetX;
            const gridY = tunnel.y + offsetY;

            // Verify the position is actually empty (in a tunnel)
            if (this.grid.isEmpty(gridX, gridY)) {
                return {
                    x: gridX * TILE_SIZE,
                    y: gridY * TILE_SIZE,
                };
            }
        }

        // Fallback: find the first empty tunnel position
        for (let y = 0; y < this.grid.height; y++) {
            for (let x = 0; x < this.grid.width; x++) {
                if (this.grid.isEmpty(x, y) && y > 2) {
                    return { x: x * TILE_SIZE, y: y * TILE_SIZE };
                }
            }
        }

        // Last resort fallback
        return { x: TILE_SIZE * 5, y: TILE_SIZE * 5 };
    }

    /**
     * Spawn bonus item in center of screen
     */
    spawnBonusItem() {
        const centerX = Math.floor(GRID_WIDTH / 2) * TILE_SIZE;
        const centerY = Math.floor(GRID_HEIGHT / 2) * TILE_SIZE;

        return {
            x: centerX,
            y: centerY,
            lifetime: 5000, // 5 seconds
            spawnTime: Date.now(),
            update: function (deltaTime) {
                // Check if expired
                if (Date.now() - this.spawnTime > this.lifetime) {
                    return false; // Mark for removal
                }
                return true;
            },
        };
    }

    /**
     * Get rocks array
     */
    getRocks() {
        return this.rocks;
    }
}
