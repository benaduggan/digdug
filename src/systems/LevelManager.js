import {
    GRID_WIDTH,
    GRID_HEIGHT,
    TILE_SIZE,
    LEVEL,
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
        this.generateTunnels();
    }

    /**
     * Generate tunnel network
     */
    generateTunnels() {
        // Create a small starting tunnel for the player in the center
        const centerX = Math.floor(GRID_WIDTH / 2);
        const centerY = Math.floor(GRID_HEIGHT / 2);

        // Small 3-tile cross pattern for player start
        this.grid.clearHorizontalTunnel(centerX - 1, centerX + 1, centerY);
        if (this.currentLevel > 1)
            this.grid.clearVerticalTunnel(centerX, 2, centerY);

        // Store player start tunnel location
        this.playerStartTunnel = { x: centerX, y: centerY };
    }

    /**
     * Place rocks strategically in the level (away from paths and enemies)
     * Called after enemies are spawned
     */
    placeRocksAfterEnemies(levelNumber, enemies) {
        // 1. Setup & Pre-calculations
        const extraRocks = Math.floor(levelNumber / 3);
        const targetRocks = Math.min(LEVEL.ROCKS_PER_LEVEL + extraRocks, 6);
        const minRocks = 3;

        const gridW = GRID_WIDTH;
        const gridH = GRID_HEIGHT;
        const midX = gridW / 2;
        const noGoMin = midX - 2;
        const noGoMax = midX + 2;

        // Cache enemy grid positions once
        const enemyGridPos = enemies.map((e) => ({
            x: Math.floor(e.x / TILE_SIZE),
            y: Math.floor(e.y / TILE_SIZE),
        }));

        this.rocks = [];

        // 2. Generate Candidate List (All valid dirt tiles)
        const candidates = [];
        const padX = 4;
        const padY = 5;

        for (let y = padY; y < gridH - 10; y++) {
            for (let x = padX; x < gridW - 8; x++) {
                // Skip No-Go Zone (Middle)
                if (x >= noGoMin && x <= noGoMax) continue;

                // Must be dirt
                if (this.grid.isDirt(x, y)) {
                    candidates.push({ x, y });
                }
            }
        }

        // 3. Shuffle Candidates (Fisher-Yates)
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        // 4. Validation Helper
        const isValidSpot = (
            candidate,
            minPathDist,
            minEnemyDist,
            minRockDist
        ) => {
            const { x, y } = candidate;

            // A. Check existing rocks
            for (let i = 0; i < this.rocks.length; i++) {
                const r = this.rocks[i];
                const dx = Math.abs(r.gridX - x);
                const dy = Math.abs(r.gridY - y);
                // If minRockDist is 0, we only fail if completely overlapping (dx=0, dy=0)
                if (dx < minRockDist && dy < minRockDist) return false;
                if (minRockDist === 0 && dx === 0 && dy === 0) return false;
            }

            // B. Check enemies
            // If minEnemyDist is 0, we skip this check (equivalent to original fallback)
            if (minEnemyDist > 0) {
                for (let i = 0; i < enemyGridPos.length; i++) {
                    const e = enemyGridPos[i];
                    const dx = Math.abs(e.x - x);
                    const dy = Math.abs(e.y - y);
                    if (dx < minEnemyDist && dy < minEnemyDist) return false;
                }
            }

            // C. Check Path Proximity (Tunnels)
            // If minPathDist is 1, checks immediate neighbors (3x3)
            for (let dy = -minPathDist; dy <= minPathDist; dy++) {
                for (let dx = -minPathDist; dx <= minPathDist; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (this.grid.isEmpty(x + dx, y + dy)) return false;
                }
            }

            return true;
        };

        // 5. Execution Passes
        const passes = [
            // Pass 1: Strict (Ideal placement) - Try to reach targetRocks
            {
                target: targetRocks,
                path: 3,
                enemy: 6,
                rock: 10,
            },
            // Pass 2: Relaxed (Compromise) - Try to reach targetRocks
            {
                target: targetRocks,
                path: 2,
                enemy: 4,
                rock: 4,
            },
            // Pass 3: Desperation (Force Minimum) - ONLY runs if we have < minRocks
            // mimic original fallback: path=1, enemy=ignored(0), rock=ignored(0)
            {
                target: minRocks,
                path: 1,
                enemy: 0,
                rock: 0,
            },
        ];

        for (const pass of passes) {
            // If we have enough rocks for this tier's goal, skip to next pass or finish
            if (this.rocks.length >= pass.target) continue;

            for (const candidate of candidates) {
                // Stop immediately if target met
                if (this.rocks.length >= pass.target) break;

                // Check if spot is occupied by a rock we JUST placed in a previous pass
                // (Since we are iterating the same list multiple times)
                if (this.grid.isRock(candidate.x, candidate.y)) continue;

                if (isValidSpot(candidate, pass.path, pass.enemy, pass.rock)) {
                    this.grid.placeRock(candidate.x, candidate.y);
                    this.rocks.push(
                        new Rock(
                            candidate.x * TILE_SIZE,
                            candidate.y * TILE_SIZE,
                            this.grid
                        )
                    );
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
                    // length is the offset, so length=2 means 3 tiles (x to x+2 inclusive)
                    const length = Math.floor(Math.random() * 2) + 2; // 3-4 tiles total

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

            // If placement failed with strict constraints, try with relaxed spacing
            if (!placed) {
                const relaxedSpacing = 4;
                let relaxedAttempts = 0;

                while (!placed && relaxedAttempts < 50) {
                    const x = Math.floor(Math.random() * (GRID_WIDTH - 8)) + 4;
                    const y = Math.floor(Math.random() * (GRID_HEIGHT - 8)) + 4;

                    if (y < 4) {
                        relaxedAttempts++;
                        continue;
                    }

                    // Only check distance from player (skip tunnel spacing check)
                    const playerCenterX = Math.floor(GRID_WIDTH / 2);
                    const playerCenterY = Math.floor(GRID_HEIGHT / 2);
                    const distFromPlayer = Math.sqrt(
                        Math.pow(x - playerCenterX, 2) +
                            Math.pow(y - playerCenterY, 2)
                    );

                    // Relaxed player distance
                    if (distFromPlayer < 6) {
                        relaxedAttempts++;
                        continue;
                    }

                    // Check with relaxed spacing
                    const tooClose = this.enemyTunnels.some((tunnel) => {
                        const dist = Math.sqrt(
                            Math.pow(tunnel.x - x, 2) +
                                Math.pow(tunnel.y - y, 2)
                        );
                        return dist < relaxedSpacing;
                    });

                    if (!tooClose) {
                        const horizontal = Math.random() > 0.5;
                        const length = Math.floor(Math.random() * 2) + 2;

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

                    relaxedAttempts++;
                }
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
                ? Math.floor(Math.random() * tunnel.length)
                : 0;
            const offsetY = tunnel.horizontal
                ? 0
                : Math.floor(Math.random() * tunnel.length);

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
     * @param {number} bonusIndex - Sequential index for determining which prize to show (0, 1, 2, ...)
     */
    spawnBonusItem(bonusIndex = 0) {
        const centerX = Math.floor(GRID_WIDTH / 2) * TILE_SIZE;
        const centerY = Math.floor(GRID_HEIGHT / 2) * TILE_SIZE;

        return {
            x: centerX,
            y: centerY,
            bonusIndex: bonusIndex, // Store the index for sequential prize selection
            FLASH_START: 3000, // Start flashing after 3 seconds
            FLASH_DURATION: 2000, // Flash for 2 seconds then disappear
            elapsedTime: 0,
            update: function (deltaTime) {
                this.elapsedTime += deltaTime;
                // Check if expired (3s visible + 2s flashing = 5s total)
                if (this.elapsedTime > this.FLASH_START + this.FLASH_DURATION) {
                    return false; // Mark for removal
                }
                return true;
            },
            isFlashing: function () {
                return this.elapsedTime >= this.FLASH_START;
            },
        };
    }

    /**
     * Spawn a single rock in a dirt tile
     * @returns {Rock|null} The spawned rock, or null if no valid position found
     */
    spawnSingleRock() {
        // Find all dirt tiles that are valid for rock placement
        const validPositions = [];

        for (let y = 4; y < GRID_HEIGHT - 2; y++) {
            for (let x = 2; x < GRID_WIDTH - 2; x++) {
                // Must be dirt
                if (!this.grid.isDirt(x, y)) continue;

                // Avoid center columns (where player starts)
                if (x >= GRID_WIDTH / 2 - 2 && x <= GRID_WIDTH / 2 + 2)
                    continue;

                // Check distance from existing rocks
                let tooCloseToRock = false;
                for (const rock of this.rocks) {
                    const rockGridX = Math.floor(rock.x / TILE_SIZE);
                    const rockGridY = Math.floor(rock.y / TILE_SIZE);
                    const dist =
                        Math.abs(x - rockGridX) + Math.abs(y - rockGridY);
                    if (dist < 4) {
                        tooCloseToRock = true;
                        break;
                    }
                }
                if (tooCloseToRock) continue;

                validPositions.push({ x, y });
            }
        }

        if (validPositions.length === 0) {
            return null; // No valid position found
        }

        // Pick a random valid position
        const pos =
            validPositions[Math.floor(Math.random() * validPositions.length)];

        // Place rock in grid
        this.grid.placeRock(pos.x, pos.y);

        // Create Rock entity (don't add to this.rocks - Game.js manages that)
        const rock = new Rock(pos.x * TILE_SIZE, pos.y * TILE_SIZE, this.grid);

        return rock;
    }

    /**
     * Get rocks array
     */
    getRocks() {
        return this.rocks;
    }
}
