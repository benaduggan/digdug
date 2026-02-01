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

        // Cache grid data
        const gridW = GRID_WIDTH;
        const gridH = GRID_HEIGHT;
        const midX = gridW / 2;
        const noGoMin = midX - 2;
        const noGoMax = midX + 2;

        // Pre-calculate enemy positions
        const enemyGridPos = enemies.map((e) => ({
            x: Math.floor(e.x / TILE_SIZE),
            y: Math.floor(e.y / TILE_SIZE),
        }));

        this.rocks = [];

        // 2. Generate Candidate List (All valid dirt tiles)
        const candidates = [];
        const padX = 4;
        const padY = 5;

        for (let y = padY; y < gridH - 5; y++) {
            for (let x = padX; x < gridW - 8; x++) {
                // Skip No-Go Zone (Center)
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

            // A. Check existing rocks (CRITICAL FIX HERE)
            for (let i = 0; i < this.rocks.length; i++) {
                const r = this.rocks[i];
                const dx = Math.abs(r.gridX - x);
                const dy = Math.abs(r.gridY - y);

                // STRICT OVERLAP CHECK:
                // If dx < minRockDist AND dy < minRockDist, it's too close.
                // Example: If minRockDist is 2, then dx=0 or dx=1 is REJECTED.
                // This ensures at least 1 tile gap between rocks.
                if (dx < minRockDist && dy < minRockDist) return false;
            }

            // B. Check enemies (skip if minEnemyDist is 0)
            if (minEnemyDist > 0) {
                for (let i = 0; i < enemyGridPos.length; i++) {
                    const e = enemyGridPos[i];
                    const dx = Math.abs(e.x - x);
                    const dy = Math.abs(e.y - y);
                    if (dx < minEnemyDist && dy < minEnemyDist) return false;
                }
            }

            // C. Check Path Proximity
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
            // Pass 1: Strict (Ideal placement)
            // rock: 10 ensures huge gaps
            {
                target: targetRocks,
                path: 3,
                enemy: 6,
                rock: 10,
            },
            // Pass 2: Relaxed (Compromise)
            // rock: 4 ensures reasonable spacing
            {
                target: targetRocks,
                path: 2,
                enemy: 4,
                rock: 4,
            },
            // Pass 3: Desperation (Force Minimum)
            // rock: 2 means dx must be >= 2. (0 and 1 are disallowed).
            // This guarantees rocks never touch, even in desperation mode.
            {
                target: minRocks,
                path: 1,
                enemy: 0,
                rock: 2,
            },
        ];

        for (const pass of passes) {
            if (this.rocks.length >= pass.target) continue;

            for (const candidate of candidates) {
                if (this.rocks.length >= pass.target) break;

                // Prevent placing on a spot that JUST became a rock in this same frame
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
        const MAX_ENEMIES = 8;

        // 1. Calculate Base Count (Step logic)
        // Level 0-9: Tier 0 (+4 base) = 4
        // Level 10-19: Tier 1 (+4 base) = 5
        // ...
        const levelTier = Math.floor(levelNumber / 10);
        let count = 3 + levelTier;

        // 2. Add Random Variance (0 or 1)
        // This creates the range (e.g. 3-4, 4-5, 5-6, 6-7)
        // We don't add variance if we are already at the max to avoid overshooting
        if (count < MAX_ENEMIES) {
            count += Math.round(Math.random());
        }

        // 3. Hard Cap at 8 enemies (Handles Level 50+)
        const numEnemies = Math.min(count, MAX_ENEMIES);

        // --- Original Ratio Logic Preserved ---

        // Calculate Pooka/Fygar ratio (more Fygars in later levels)
        // Caps at 50% Fygars
        const fygarRatio = Math.min(0.5, 0.2 + levelNumber * 0.05);
        const numFygars = Math.floor(numEnemies * fygarRatio);
        const numPookas = numEnemies - numFygars;

        // Create tunnels for enemies
        this.createEnemyTunnels(numEnemies);

        // Spawn Pookas
        for (let i = 0; i < numPookas; i++) {
            const pos = this.getEnemySpawnPosition(i);
            enemies.push(new Pooka(pos.x, pos.y, levelNumber));
        }

        // Spawn Fygars
        for (let i = 0; i < numFygars; i++) {
            // Offset the spawn index by numPookas so they don't spawn on top of Pookas
            const pos = this.getEnemySpawnPosition(numPookas + i);
            enemies.push(new Fygar(pos.x, pos.y, levelNumber));
        }

        return enemies;
    }

    /**
     * Create tunnels for enemies to spawn in
     */
    createEnemyTunnels(numEnemies) {
        this.enemyTunnels = []; // Reset

        // 1. Setup Constants & Pre-calculations
        const gridW = GRID_WIDTH;
        const gridH = GRID_HEIGHT;
        const playerCX = Math.floor(gridW / 2);
        const playerCY = Math.floor(gridH / 2);

        // Squared distances for player proximity (Fast math)
        const STRICT_PLAYER_DIST_SQ = 100; // 10 tiles
        const RELAXED_PLAYER_DIST_SQ = 36; // 6 tiles

        // 2. Generate Candidate List
        // We filter out the obvious "player start" area early to keep the list small
        const candidates = [];
        const padX = 4;
        const padY = 4;

        for (let y = padY; y < gridH - padY; y++) {
            for (let x = padX; x < gridW - padX; x++) {
                // Optimization: Skip player center immediately
                const dx = x - playerCX;
                const dy = y - playerCY;
                if (dx * dx + dy * dy < RELAXED_PLAYER_DIST_SQ) continue;

                candidates.push({ x, y });
            }
        }

        // 3. Shuffle Candidates (Fisher-Yates)
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        // 4. Helper: Get Bounding Box for a Tunnel
        // Returns { minX, maxX, minY, maxY }
        const getTunnelBounds = (x, y, horizontal, length) => {
            if (horizontal) {
                // Horizontal: grows to the right
                // Limit length to grid bounds to prevent array out of bounds logic
                const actualLen = Math.min(length, gridW - 2 - x);
                return { minX: x, maxX: x + actualLen, minY: y, maxY: y };
            } else {
                // Vertical: grows down
                const actualLen = Math.min(length, gridH - 2 - y);
                return { minX: x, maxX: x, minY: y, maxY: y + actualLen };
            }
        };

        // 5. Helper: Intersection Check (AABB with Buffer)
        // Ensures New Tunnel (A) is at least 'spacing' tiles away from Existing (B)
        const checkOverlap = (rectA, rectB, spacing) => {
            // We expand Rect B by 'spacing' in all directions.
            // If Rect A touches this expanded area, it's too close.
            return (
                rectA.minX <= rectB.maxX + spacing &&
                rectA.maxX >= rectB.minX - spacing &&
                rectA.minY <= rectB.maxY + spacing &&
                rectA.maxY >= rectB.minY - spacing
            );
        };

        // 6. Main Placement Logic
        const attemptPlacement = (spacingBuffer, minPlayerDistSq) => {
            // Iterate through shuffled candidates
            // We use a simple index to avoid destroying the array, allowing reuse in Pass 2
            for (let i = 0; i < candidates.length; i++) {
                if (this.enemyTunnels.length >= numEnemies) return;

                const { x, y } = candidates[i];

                // 1. Check Player Distance (Squared)
                const pdx = x - playerCX;
                const pdy = y - playerCY;
                if (pdx * pdx + pdy * pdy < minPlayerDistSq) continue;

                // 2. Generate Random Geometry
                // We must decide this NOW to check valid bounding box
                const horizontal = Math.random() > 0.5;
                const length = Math.floor(Math.random() * 2) + 2; // 3 to 4 tiles total

                const newRect = getTunnelBounds(x, y, horizontal, length);

                // 3. Check against ALL existing tunnels
                let valid = true;
                for (const existing of this.enemyTunnels) {
                    // If checking overlap returns true, it's a collision
                    if (checkOverlap(newRect, existing.bounds, spacingBuffer)) {
                        valid = false;
                        break;
                    }
                }

                if (valid) {
                    // Render Logic
                    if (horizontal) {
                        this.grid.clearHorizontalTunnel(
                            newRect.minX,
                            newRect.maxX,
                            newRect.minY
                        );
                    } else {
                        this.grid.clearVerticalTunnel(
                            newRect.minX,
                            newRect.minY,
                            newRect.maxY
                        );
                    }

                    // Store with pre-calculated bounds for future checks
                    this.enemyTunnels.push({
                        x,
                        y,
                        horizontal,
                        length,
                        bounds: newRect,
                    });
                }
            }
        };

        // 7. Execution Passes

        // Pass 1: Strict Constraints
        // Buffer 6: ensures huge separation between tunnels
        attemptPlacement(6, STRICT_PLAYER_DIST_SQ);

        // Pass 2: Relaxed Constraints (if needed)
        // Buffer 2: CRITICAL.
        // A buffer of 1 means they can touch corners or be adjacent.
        // A buffer of 2 guarantees at least 1 empty tile of dirt between them.
        if (this.enemyTunnels.length < numEnemies) {
            attemptPlacement(2, RELAXED_PLAYER_DIST_SQ);
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
