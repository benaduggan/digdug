import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    TILE_SIZE,
    COLORS,
    TILE_TYPES,
    DIRECTIONS,
    DEATH,
    ENEMY_TYPES,
} from './utils/constants.js';
import { loadImage } from './utils/loadImage.js';
import { getDirtGradient } from './utils/dirtGradient.js';

export class Renderer {
    constructor(config) {
        this.config = config;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');

        // Set canvas size
        this.canvas.width = config.width;
        this.canvas.height = config.height;

        // Apply scaling
        if (config.scale && config.scale !== 1) {
            this.canvas.style.width = `${config.width * config.scale}px`;
            this.canvas.style.height = `${config.height * config.scale}px`;
        }

        // Disable image smoothing for pixel-perfect rendering
        this.ctx.imageSmoothingEnabled = false;

        // Spritesheet and sprite map
        this.spritesheet = null;
        this.sprites = {};
        this.spritesLoaded = false;

        // Background cache - pre-rendered dirt layer for performance
        this.backgroundCanvas = document.createElement('canvas');
        this.backgroundCanvas.width = config.width;
        this.backgroundCanvas.height = config.height;
        this.backgroundCtx = this.backgroundCanvas.getContext('2d');
        this.backgroundCtx.imageSmoothingEnabled = false;
        this.backgroundDirty = true; // Flag to rebuild background when grid changes
        this.lastGridState = null; // Track grid state to detect changes
    }

    /**
     * Load spritesheet and sprite map
     */
    async loadSprites() {
        try {
            // Load spritesheet image and sprite map JSON in parallel
            const [spritesheetImg, spriteMapResponse] = await Promise.all([
                loadImage('/assets/sprites/spritesheet.png'),
                fetch('/assets/sprites/sprite_map.json'),
            ]);

            this.spritesheet = spritesheetImg;
            const spriteMapArray = await spriteMapResponse.json();

            // Convert array to lookup object by name
            this.sprites = {};
            spriteMapArray.forEach((sprite) => {
                this.sprites[sprite.name] = sprite;
            });

            this.spritesLoaded = true;
        } catch (error) {
            console.error('Failed to load spritesheet:', error);
        }
    }

    /**
     * Draw a sprite from the spritesheet
     * @param {string} name - Sprite name from sprite_map.json
     * @param {number} x - X position to draw at
     * @param {number} y - Y position to draw at
     * @param {number|null} width - Draw width (null = use sprite's natural width)
     * @param {number|null} height - Draw height (null = use sprite's natural height)
     * @param {boolean} flipH - Flip horizontally
     * @param {boolean} flipV - Flip vertically
     * @returns {boolean} - Whether the sprite was drawn successfully
     */
    drawSprite(
        name,
        x,
        y,
        width = null,
        height = null,
        flipH = false,
        flipV = false
    ) {
        if (!this.spritesLoaded || !this.spritesheet) return false;

        const sprite = this.sprites[name];
        if (!sprite) return false;

        // Use sprite's natural size if not specified
        const drawWidth = width ?? sprite.width;
        const drawHeight = height ?? sprite.height;

        if (flipH || flipV) {
            this.ctx.save();
            this.ctx.translate(x + drawWidth / 2, y + drawHeight / 2);
            this.ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
            this.ctx.drawImage(
                this.spritesheet,
                sprite.x,
                sprite.y,
                sprite.width,
                sprite.height,
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );
            this.ctx.restore();
        } else {
            this.ctx.drawImage(
                this.spritesheet,
                sprite.x,
                sprite.y,
                sprite.width,
                sprite.height,
                x,
                y,
                drawWidth,
                drawHeight
            );
        }
        return true;
    }

    /**
     * Draw a sprite centered at a position (useful for variable-size sprites)
     * @param {string} name - Sprite name from sprite_map.json
     * @param {number} centerX - Center X position
     * @param {number} centerY - Center Y position
     * @param {boolean} flipH - Flip horizontally
     * @param {boolean} flipV - Flip vertically
     * @returns {boolean} - Whether the sprite was drawn successfully
     */
    drawSpriteCentered(name, centerX, centerY, flipH = false, flipV = false) {
        if (!this.spritesLoaded || !this.spritesheet) return false;

        const sprite = this.sprites[name];
        if (!sprite) return false;

        const x = centerX - sprite.width / 2;
        const y = centerY - sprite.height / 2;

        if (flipH || flipV) {
            this.ctx.save();
            this.ctx.translate(centerX, centerY);
            this.ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
            this.ctx.drawImage(
                this.spritesheet,
                sprite.x,
                sprite.y,
                sprite.width,
                sprite.height,
                -sprite.width / 2,
                -sprite.height / 2,
                sprite.width,
                sprite.height
            );
            this.ctx.restore();
        } else {
            this.ctx.drawImage(
                this.spritesheet,
                sprite.x,
                sprite.y,
                sprite.width,
                sprite.height,
                x,
                y,
                sprite.width,
                sprite.height
            );
        }
        return true;
    }

    /**
     * Attach canvas to DOM container
     */
    attachTo(container) {
        container.appendChild(this.canvas);
    }

    drawMenu(scoreManager) {
        const { ctx, sprites, spritesheet, spritesLoaded } = this;
        if (!spritesLoaded || !spritesheet) return;

        this.drawHiScore(scoreManager);

        /**
         * Helper to reduce repetitive logic and ensure whole-pixel rendering
         */
        const draw = (key, dx, dy) => {
            const s = sprites[key];
            if (!s) return;

            // Bitwise OR 0 is a fast way to floor coordinates to integers
            ctx.drawImage(
                spritesheet,
                s.x,
                s.y,
                s.width,
                s.height, // Source
                dx | 0,
                dy | 0,
                s.width,
                s.height // Destination
            );
        };

        // Title - Centered
        const title = sprites['dig_dug_title'];
        if (title)
            draw(
                'dig_dug_title',
                (CANVAS_WIDTH - title.width) / 2,
                TILE_SIZE * 4
            );

        // Characters (Dig Dug & Enemies)
        const charY = (CANVAS_HEIGHT * 0.425) | 0;
        const sideMargin = CANVAS_WIDTH * 0.3;

        if (sprites['dig_dug']) draw('dig_dug', sideMargin, charY);

        const enemies = sprites['enemies'];
        if (enemies)
            draw('enemies', CANVAS_WIDTH - enemies.width - sideMargin, charY);

        this.drawText(
            '▶ 1 PLAYER',
            (CANVAS_WIDTH / 2) | 0,
            (CANVAS_HEIGHT * 0.8) | 0,
            {
                scale: 1,
                align: 'center',
            }
        );

        // Namco Logo & Copyright
        const namco = sprites['namco'];
        if (namco)
            draw('namco', (CANVAS_WIDTH - namco.width) / 2, CANVAS_HEIGHT - 24);

        this.drawText(
            '© 1982 NAMCO LTD.',
            (CANVAS_WIDTH / 2) | 0,
            (CANVAS_HEIGHT - 5) | 0,
            {
                scale: 1,
                align: 'center',
            }
        );
    }

    /**
     * Clear the canvas
     * Note: With background caching, we don't need to clear to black
     * since drawGrid() will overwrite with the cached background
     */
    clear() {
        // Only clear if background isn't ready yet
        if (this.backgroundDirty || !this.lastGridState) {
            this.ctx.fillStyle = COLORS.BACKGROUND;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * Force clear the canvas to black (for menus, game over screens, etc.)
     */
    forceClear() {
        this.ctx.fillStyle = COLORS.BACKGROUND;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Mark the background as needing redraw (call when grid changes)
     */
    markBackgroundDirty() {
        this.backgroundDirty = true;
    }

    /**
     * Draw the grid using cached background for performance
     * Only redraws when grid actually changes
     */
    drawGrid(grid, currentLevel) {
        // Check if grid state changed (simple hash of tunnel positions)
        const currentGridState = grid.getStateHash ? grid.getStateHash() : null;
        if (currentGridState !== this.lastGridState) {
            this.backgroundDirty = true;
            this.lastGridState = currentGridState;
        }

        // Rebuild background cache if dirty
        if (this.backgroundDirty) {
            this.renderBackgroundToCache(grid, currentLevel);
            this.backgroundDirty = false;
        }

        // Draw cached background in one operation
        this.ctx.drawImage(this.backgroundCanvas, 0, 0);
    }

    /**
     * Get neighbor info for an empty tile
     * Returns object with booleans for each direction that borders dirt/rock
     */
    getEmptyTileNeighbors(grid, x, y) {
        const bottomUIRow = grid.height - 1;
        // Treat bottom UI row as "solid" so tunnels above it render bottom edges
        const isNeighborDirt = (nx, ny) => {
            if (ny === bottomUIRow) return true; // Bottom UI row acts as solid for edge rendering
            return !grid.isEmpty(nx, ny);
        };
        return {
            top: isNeighborDirt(x, y - 1) && y > 1, // y > 1 to exclude sky
            bottom: isNeighborDirt(x, y + 1),
            left: isNeighborDirt(x - 1, y),
            right: isNeighborDirt(x + 1, y),
            // Diagonals for corner detection
            topLeft: isNeighborDirt(x - 1, y - 1) && y > 1,
            topRight: isNeighborDirt(x + 1, y - 1) && y > 1,
            bottomLeft: isNeighborDirt(x - 1, y + 1),
            bottomRight: isNeighborDirt(x + 1, y + 1),
        };
    }

    getDirtColorHSL(ratio, currentLevel) {
        // Clamp ratio between 0 and 1
        const r = Math.max(0, Math.min(1, ratio));
        const dirtGradient = getDirtGradient(currentLevel);

        // Find the two colors we are between (e.g., Light and Mid)
        let lower = dirtGradient[0];
        let upper = dirtGradient[dirtGradient.length - 1];

        for (let i = 0; i < dirtGradient.length - 1; i++) {
            if (r >= dirtGradient[i].stop && r <= dirtGradient[i + 1].stop) {
                lower = dirtGradient[i];
                upper = dirtGradient[i + 1];
                break;
            }
        }

        // Calculate how far we are between the two stops (0.0 to 1.0)
        // e.g. if Stops are 0.33 and 0.66, and ratio is 0.5, mixPercent is ~0.5
        const range = upper.stop - lower.stop;
        const mixPercent = (r - lower.stop) / range;

        // Linear Interpolation (Lerp) the H, S, and L values
        // Note: If Range is 0 (end of array), avoid divide by zero
        if (range === 0) return upper.color;

        return {
            h: Math.round(
                lower.color.h + (upper.color.h - lower.color.h) * mixPercent
            ),
            s: Math.round(
                lower.color.s + (upper.color.s - lower.color.s) * mixPercent
            ),
            l: Math.round(
                lower.color.l + (upper.color.l - lower.color.l) * mixPercent
            ),
        };
    }

    /**
     * Draw pixel edges for an empty tile
     * OPTIMIZED: Batches all geometry into a single draw call
     */
    drawTunnelEdges(ctx, px, py, neighbors, depthRatio, currentLevel) {
        // 1. Set style once
        const { h, s, l } = this.getDirtColorHSL(depthRatio, currentLevel);
        ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;

        // 2. Begin a single path for all pixels
        ctx.beginPath();

        // 3. Add rects to the path (no drawing yet)
        if (neighbors.top) this.addTunnelEdgePath(ctx, px, py, 'top');
        if (neighbors.bottom) this.addTunnelEdgePath(ctx, px, py, 'bottom');
        if (neighbors.left) this.addTunnelEdgePath(ctx, px, py, 'left');
        if (neighbors.right) this.addTunnelEdgePath(ctx, px, py, 'right');

        // 4. Add corners to the path
        this.addRoundedCornersPath(ctx, px, py, neighbors);

        // 5. Execute the single draw command
        ctx.fill();
    }

    /**
     * Adds uniform pixel rects to the current path
     */
    addTunnelEdgePath(ctx, px, py, side) {
        // We use local variables for loop limits to avoid property lookup overhead
        const size = TILE_SIZE;

        if (side === 'top') {
            for (let dx = 0; dx < size; dx += 4) {
                ctx.rect(px + dx + 1, py, 2, 1);
            }
        } else if (side === 'bottom') {
            const yPos = py + size - 1;
            for (let dx = 0; dx < size; dx += 4) {
                ctx.rect(px + dx + 1, yPos, 2, 1);
            }
        } else if (side === 'left') {
            for (let dy = 0; dy < size; dy += 4) {
                ctx.rect(px, py + dy + 1, 1, 2);
            }
        } else if (side === 'right') {
            const xPos = px + size - 1;
            for (let dy = 0; dy < size; dy += 4) {
                ctx.rect(xPos, py + dy + 1, 1, 2);
            }
        }
    }

    /**
     * Adds corner rects to the current path
     */
    addRoundedCornersPath(ctx, px, py, neighbors) {
        // Pre-calculate the "far" offsets once
        const farEdge = TILE_SIZE - 2;

        // Top-left
        if (neighbors.top && neighbors.left) {
            ctx.rect(px, py, 2, 2);
        }
        // Top-right
        if (neighbors.top && neighbors.right) {
            ctx.rect(px + farEdge, py, 2, 2);
        }
        // Bottom-left
        if (neighbors.bottom && neighbors.left) {
            ctx.rect(px, py + farEdge, 2, 2);
        }
        // Bottom-right
        if (neighbors.bottom && neighbors.right) {
            ctx.rect(px + farEdge, py + farEdge, 2, 2);
        }
    }

    /**
     * Render the full background to the cache canvas
     * Called only when grid changes
     */
    renderBackgroundToCache(grid, currentLevel) {
        const ctx = this.backgroundCtx;

        // Clear with background color
        ctx.fillStyle = COLORS.BACKGROUND;
        ctx.fillRect(
            0,
            0,
            this.backgroundCanvas.width,
            this.backgroundCanvas.height
        );

        for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
                const tile = grid.getTile(x, y);
                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;

                // Top 2 rows are sky
                if (y < 2) {
                    ctx.fillStyle = COLORS.SKY;
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    continue;
                }

                // Bottom row is UI area (black, inaccessible)
                if (y === grid.height - 1) {
                    ctx.fillStyle = COLORS.BACKGROUND;
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    continue;
                }

                if (tile === TILE_TYPES.DIRT || tile === TILE_TYPES.ROCK) {
                    const depthRatio = (y - 2) / (grid.height - 2);

                    // 1. Get Calculated HSL
                    const { h, s, l } = this.getDirtColorHSL(
                        depthRatio,
                        currentLevel
                    );

                    // 2. Draw Base
                    ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

                    // 3. Boost Saturation for Specs
                    // Shadow: Darker (-15%) and Richer (+20% Saturation)
                    const shadowColor = `hsl(${h}, ${Math.min(100, s + 20)}%, ${Math.max(0, l - 15)}%)`;

                    // Highlight: Brighter (+10%) and Richer (+10% Saturation)
                    const lightColor = `hsl(${h}, ${Math.min(100, s + 10)}%, ${Math.min(100, l + 10)}%)`;

                    // 4. Texture Loop (Spread out 4px grid)
                    const STEP = 4;
                    const SPEC_SIZE = 2; // 2x2 specs

                    // --- PASS 1: Saturated Shadows ---
                    ctx.fillStyle = shadowColor;
                    for (let dy = 0; dy < TILE_SIZE; dy += STEP) {
                        for (let dx = 0; dx < TILE_SIZE; dx += STEP) {
                            const seedX = x * TILE_SIZE + dx;
                            const seedY = y * TILE_SIZE + dy;
                            const noise =
                                Math.abs(
                                    Math.sin(seedX * 12.989 + seedY * 78.233) *
                                        43758.545
                                ) % 1;

                            if (noise < 0.15) {
                                ctx.fillRect(
                                    px + dx + 1,
                                    py + dy + 1,
                                    SPEC_SIZE,
                                    SPEC_SIZE
                                );
                            }
                        }
                    }

                    // --- PASS 2: Vibrant Highlights ---
                    ctx.fillStyle = lightColor;
                    for (let dy = 0; dy < TILE_SIZE; dy += STEP) {
                        for (let dx = 0; dx < TILE_SIZE; dx += STEP) {
                            const seedX = x * TILE_SIZE + dx;
                            const seedY = y * TILE_SIZE + dy;
                            const noise =
                                Math.abs(
                                    Math.sin(seedX * 90.123 + seedY * 11.456) *
                                        12345.678
                                ) % 1;

                            if (noise < 0.08) {
                                ctx.fillRect(
                                    px + dx + 1,
                                    py + dy + 1,
                                    SPEC_SIZE,
                                    SPEC_SIZE
                                );
                            }
                        }
                    }
                } else if (tile === TILE_TYPES.EMPTY) {
                    // Draw rounded edges for empty tiles (tunnels)
                    const neighbors = this.getEmptyTileNeighbors(grid, x, y);
                    const hasEdge =
                        neighbors.top ||
                        neighbors.bottom ||
                        neighbors.left ||
                        neighbors.right;

                    if (hasEdge) {
                        const depthRatio = (y - 2) / (grid.height - 2);
                        this.drawTunnelEdges(
                            ctx,
                            px,
                            py,
                            neighbors,
                            depthRatio,
                            currentLevel
                        );
                    }
                }
            }
        }
    }

    /**
     * Get the player's orientation for sprite rendering
     */
    getPlayerOrientation(player) {
        return player.direction === DIRECTIONS.LEFT ||
            player.direction === DIRECTIONS.RIGHT
            ? 'horizontal'
            : 'vertical';
    }

    /**
     * Draw the player with walking sprites
     */
    drawPlayer(player) {
        // Handle death animation
        if (player.isDying) {
            this.drawPlayerDeath(player);
            return;
        }

        // Flicker during invincibility
        if (player.isInvincible) {
            const flickerVisible =
                Math.floor(player.invincibilityTimer / 100) % 2 === 0;
            if (!flickerVisible) return; // Skip rendering on flicker-off frames
        }

        // Draw pump line if pumping
        if (player.pumpLength > 0) {
            this.drawPumpLine(player);
        }

        const px = player.x;
        const py = player.y;

        if (!this.spritesLoaded) return;

        // Determine which sprite set to use (horizontal or vertical, walking or digging)
        let spriteAction = 'walking';
        if (player.isDigging) spriteAction = 'digging';
        else if (player.isPumping) spriteAction = 'pumping';

        let frameNumber = player.animationFrame === 0 ? '_1' : '_2';
        const orientation = this.getPlayerOrientation(player);

        if (player.isShooting) {
            spriteAction = 'shooting';
            frameNumber = '';
        }

        const spriteName = `player_${spriteAction}_${orientation}${frameNumber}`;
        this.drawSprite(
            spriteName,
            px,
            py,
            TILE_SIZE,
            TILE_SIZE,
            player.spriteFlipH,
            player.spriteFlipV
        );
    }

    /**
     * Draw a sprite from the spritesheet at TILE_SIZE, centered on position
     * Used for pump line rendering
     */
    drawFlippedSpriteByName(centerX, centerY, flipH, flipV, spriteName) {
        this.drawSpriteCentered(spriteName, centerX, centerY, flipH, flipV);
    }

    /**
     * Draw player death animation
     */
    drawPlayerDeath(player) {
        if (!this.spritesLoaded) return;

        const px = player.x;
        const py = player.y;
        const orientation = this.getPlayerOrientation(player);

        // If smooshed and still falling with rock OR waiting for delay, show smooshed sprite
        if (
            player.isSmooshed &&
            (player.attachedToRock?.isFalling ||
                player.smooshedDelayTimer < player.SMOOSHED_DELAY)
        ) {
            const spriteName = `player_smooshed_${orientation}`;
            this.drawSprite(
                spriteName,
                px,
                py,
                TILE_SIZE,
                TILE_SIZE,
                player.spriteFlipH,
                false
            );
            return;
        }

        // Death animation
        const progress = player.deathTimer / DEATH.ANIMATION_DURATION;
        // Calculate frame number (1-5) based on progress
        const frameNumber = Math.min(5, Math.floor(progress * 5) + 1);
        const spriteName = `player_dying_${orientation}_${frameNumber}`;

        // Apply horizontal flip if needed, but never vertical flip
        this.drawSprite(
            spriteName,
            px,
            py,
            TILE_SIZE,
            TILE_SIZE,
            player.spriteFlipH,
            false
        );
    }

    /**
     * Draw pump line extending from player
     */
    drawPumpLine(player) {
        // 1. Early exit if system isn't ready
        if (!this.spritesLoaded) return;

        // 2. Cache constants and frequently accessed properties
        const TILE = TILE_SIZE;
        const halfTile = TILE / 2;
        const px = player.x;
        const py = player.y;
        const endPoint = player.getPumpEndPoint();

        // 3. Resolve orientation and sprite names
        const orientation = this.getPlayerOrientation(player);
        const nozzleName = `hose_nozzle_${orientation}`;
        const lineName = `hose_line_${orientation}`;

        // Check sprites exist
        if (!this.sprites[nozzleName] || !this.sprites[lineName]) {
            return;
        }

        // 4. Calculate Grid Difference
        const diffX = Math.round((px + halfTile - endPoint.x) / TILE);
        const diffY = Math.round((py + halfTile - endPoint.y) / TILE);

        // Cache Flip states
        const flipH = player.spriteFlipH;
        const flipV = player.spriteFlipV;

        // --- DOWN (Player looking DOWN) ---
        if (diffY < 0) {
            let segments = Math.abs(diffY) - 1;

            if (flipH) {
                const dx = px + halfTile;
                let dy = endPoint.y - TILE * 0.25;

                this.drawSpriteCentered(nozzleName, dx, dy, flipH, flipV);

                while (segments > 0) {
                    dy -= TILE;
                    this.drawSpriteCentered(lineName, dx, dy, flipH, flipV);
                    segments--;
                }
            } else {
                const dx = px;
                let dy = endPoint.y - TILE * 0.75;

                this.drawSprite(nozzleName, dx, dy, TILE, TILE);

                while (segments > 0) {
                    dy -= TILE;
                    this.drawSprite(lineName, dx, dy, TILE, TILE);
                    segments--;
                }
            }
            return;
        }

        // --- UP (Player looking UP) ---
        if (diffY > 0) {
            let segments = Math.abs(diffY) - 1;

            // Logic: UP always uses centered draw with flip
            const dx = px + halfTile;
            let dy = endPoint.y + TILE * 0.25;

            this.drawSpriteCentered(nozzleName, dx, dy, flipH, flipV);

            while (segments > 0) {
                dy += TILE;
                this.drawSpriteCentered(lineName, dx, dy, flipH, flipV);
                segments--;
            }
            return;
        }

        // --- RIGHT (Player looking RIGHT) ---
        if (diffX < 0) {
            let segments = Math.abs(diffX) - 1;

            // Logic: RIGHT always uses centered draw with flip
            let dx = endPoint.x - TILE * 0.25;
            const dy = py + halfTile;

            this.drawSpriteCentered(nozzleName, dx, dy, flipH, flipV);

            while (segments > 0) {
                dx -= TILE;
                this.drawSpriteCentered(lineName, dx, dy, flipH, flipV);
                segments--;
            }
            return;
        }

        // --- LEFT (Player looking LEFT) ---
        if (diffX > 0) {
            let segments = Math.abs(diffX) - 1;

            // Logic: LEFT always uses standard draw
            let dx = endPoint.x - TILE * 0.25;

            this.drawSprite(nozzleName, dx, py, TILE, TILE);

            while (segments > 0) {
                dx += TILE;
                this.drawSprite(lineName, dx, py, TILE, TILE);
                segments--;
            }
        }
    }

    /**
     * Draw an enemy with inflation, popped, and smooshed states
     */
    drawEnemy(enemy) {
        if (!this.spritesLoaded) return;

        const px = enemy.x;
        const py = enemy.y;
        const centerX = px + TILE_SIZE / 2;
        const centerY = py + TILE_SIZE / 2;

        // Handle smooshed state (crushed by rock)
        if (enemy.isSmooshed) {
            const spriteName = `${enemy.type}_smooshed`;
            this.drawSpriteCentered(
                spriteName,
                centerX,
                centerY,
                enemy.spriteFlipH
            );
            return;
        }

        // Handle popped state (after full inflation)
        if (enemy.isPopped) {
            const spriteName = `${enemy.type}_popped`;
            this.drawSpriteCentered(
                spriteName,
                centerX,
                centerY,
                enemy.spriteFlipH
            );
            return;
        }

        // Handle inflating state (being pumped)
        if (enemy.inflateLevel > 1.0) {
            // inflateLevel goes from 1.0 to 2.0
            // Map to sprite stages: 1.0-1.33 = stage 1, 1.33-1.66 = stage 2, 1.66-2.0 = stage 3
            const inflateProgress = (enemy.inflateLevel - 1.0) / 1.0; // 0 to 1
            let stage;
            if (inflateProgress < 0.33) {
                stage = 1;
            } else if (inflateProgress < 0.66) {
                stage = 2;
            } else {
                stage = 3;
            }

            const spriteName = `${enemy.type}_inflating_${stage}`;
            this.drawSpriteCentered(
                spriteName,
                centerX,
                centerY,
                enemy.spriteFlipH
            );
            return;
        }

        // Normal state - use walking/ghosting sprites
        const frameNumber = enemy.animationFrame === 0 ? '1' : '2';
        const state = enemy.isGhosting ? 'ghosting' : 'walking';
        const spriteName = `${enemy.type}_${state}_${frameNumber}`;
        this.drawSpriteCentered(
            spriteName,
            centerX,
            centerY,
            enemy.spriteFlipH
        );

        // Draw fire breath for Fygar
        if (enemy.type === ENEMY_TYPES.FYGAR) {
            if (enemy.isCharging && enemy.isCharging()) {
                this.drawFygarCharging(enemy);
            } else if (enemy.isFireActive && enemy.isFireActive()) {
                this.drawFygarFire(enemy);
            }
        }
    }

    /**
     * Draw Fygar charging animation (pulsing/flashing before fire)
     */
    drawFygarCharging(enemy) {
        const centerX = enemy.x + TILE_SIZE / 2;
        const centerY = enemy.y + TILE_SIZE / 2;
        const direction = enemy.getFireDirection();

        // Flash orange/red to indicate charging
        const flashRate = Math.floor(Date.now() / 100) % 2;
        this.ctx.fillStyle = flashRate === 0 ? '#ff6600' : '#ff3300';

        // Draw small flame particles near mouth
        const offsetX =
            direction === DIRECTIONS.RIGHT ? TILE_SIZE / 2 : -TILE_SIZE / 2;

        this.ctx.beginPath();
        this.ctx.arc(centerX + offsetX, centerY, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * Draw Fygar fire breath using sprites
     * Fire extends progressively: 1 tile (fire_1) -> 2 tiles (fire_2) -> 3 tiles (fire_3)
     * Each sprite is already the correct width (1, 2, or 3 tiles), so draw once
     */
    drawFygarFire(enemy) {
        if (!this.spritesLoaded || !this.spritesheet) return;

        const fireHitbox = enemy.getFireHitbox();
        if (!fireHitbox) return;

        const direction = enemy.getFireDirection();
        const facingLeft = direction === DIRECTIONS.LEFT;

        // Get current fire length (1-3 tiles based on timer)
        const tileCount = enemy.getFireTileCount ? enemy.getFireTileCount() : 3;

        // Use the sprite that matches current fire length
        // fire_1 = 1 tile wide, fire_2 = 2 tiles wide, fire_3 = 3 tiles wide
        const spriteName = `fygar_fire_${tileCount}`;
        const sprite = this.sprites[spriteName];
        if (!sprite) return;

        // Get sprite dimensions from sprite map
        const spriteWidth = sprite.width;
        const spriteHeight = sprite.height;

        // Calculate fire position - starts at Fygar's mouth
        let fireX;
        if (facingLeft) {
            // Fire extends to the left from Fygar
            fireX = enemy.x - spriteWidth;
        } else {
            // Fire extends to the right from Fygar
            fireX = enemy.x + TILE_SIZE;
        }
        const fireY = enemy.y;

        // Move to center of fire for flipping
        const centerX = fireX + spriteWidth / 2;
        const centerY = fireY + spriteHeight / 2;

        this.ctx.save();
        this.ctx.translate(centerX, centerY);

        // Flip horizontally if facing right (sprites are drawn facing left)
        if (!facingLeft) {
            this.ctx.scale(-1, 1);
        }

        // Draw sprite centered from spritesheet
        this.ctx.drawImage(
            this.spritesheet,
            sprite.x,
            sprite.y,
            spriteWidth,
            spriteHeight,
            -spriteWidth / 2,
            -spriteHeight / 2,
            spriteWidth,
            spriteHeight
        );

        this.ctx.restore();
    }

    /**
     * Draw a rock with shaking and crumbling animations
     */
    drawRock(rock) {
        if (!this.spritesLoaded) return;

        const px = rock.x;
        const py = rock.y;

        // Spawn animation - fade in with flash effect
        if (rock.isSpawning) {
            const progress = rock.spawnTimer / rock.SPAWN_DURATION;
            // Fade in from 0 to 1 over the duration
            const baseAlpha = progress;
            // Flash effect - oscillate rapidly, faster as we progress
            const flashFrequency = 8 + progress * 12; // 8-20 Hz flash
            const flashPhase = Math.sin(
                rock.spawnTimer * flashFrequency * 0.01
            );
            // Flash intensity decreases as spawn completes
            const flashIntensity = (1 - progress) * 0.4;
            const alpha = Math.min(1, baseAlpha + flashPhase * flashIntensity);

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, alpha);
            this.drawSprite('rock_1', px, py, TILE_SIZE, TILE_SIZE);
            this.ctx.restore();
            return;
        }

        // Crumble animation - alternate between crumbling sprites
        if (rock.isCrumbling) {
            const progress = rock.crumbleTimer / rock.CRUMBLE_DURATION;
            // First half: crumbling_1, second half: crumbling_2
            const spriteName =
                progress < 0.5 ? 'rock_crumbling_1' : 'rock_crumbling_2';
            this.drawSprite(spriteName, px, py, TILE_SIZE, TILE_SIZE);
            return;
        }

        // Calculate shake offset and determine sprite for shaking
        let spriteName = 'rock_1';

        if (rock.isShaking) {
            // Alternate between rock_1 and rock_2 every 100ms while shaking
            spriteName =
                Math.floor(rock.shakeTimer / 200) % 2 === 0
                    ? 'rock_1'
                    : 'rock_2';
        }

        this.drawSprite(spriteName, px, py, TILE_SIZE, TILE_SIZE);
    }

    /**
     * Draw bonus item with level-based prize sprites
     * Prizes unlock every 20 levels, spawning in order (0, 1, 2 within available range)
     * Item flashes after 3 seconds and disappears after 5 seconds total
     */
    drawBonusItem(item, level = 1) {
        if (!this.spritesLoaded) return;

        const px = item.x;
        const py = item.y;

        // If flashing, toggle visibility every 100ms
        if (item.isFlashing && item.isFlashing()) {
            const flashVisible = Math.floor(item.elapsedTime / 100) % 2 === 0;
            if (!flashVisible) return; // Skip rendering on flash-off frames
        }

        // 1. Calculate the "Starting Prize" for this level range.
        // At level 1, start at 0. At level 160, start at 8 (Prize 9).
        // We use Math.min to ensure we don't exceed the index for Prize 9.
        const floorIndex = Math.min(Math.floor((level - 1) / 20), 8);

        // 2. Use sequential bonusIndex (cycles through 0, 1, 2) instead of random
        const localIndex = (item.bonusIndex || 0) % 3;

        // 3. Final Prize Number
        // This ensures prizes spawn in order within the available range
        const prizeNumber = Math.min(floorIndex + localIndex + 1, 11);

        const spriteName = `prize_${prizeNumber}`;
        this.drawSprite(spriteName, px, py, TILE_SIZE, TILE_SIZE);
    }

    /**
     * Draw floating score displays
     */
    drawFloatingScores(floatingScores) {
        if (!this.spritesLoaded || !this.spritesheet) return;

        floatingScores.forEach((score) => {
            // Look up sprite by score_[points] name (e.g., score_200, score_1000)
            const spriteName = `score_${score.points}`;
            const sprite = this.sprites[spriteName];
            if (!sprite) return;

            // Center the score sprite on the position, round to integers for crisp rendering
            const drawX = Math.round(score.x + (TILE_SIZE - sprite.width) / 2);
            const drawY = Math.round(score.y + (TILE_SIZE - sprite.height) / 2);

            this.ctx.drawImage(
                this.spritesheet,
                sprite.x,
                sprite.y,
                sprite.width,
                sprite.height,
                drawX,
                drawY,
                sprite.width,
                sprite.height
            );
        });
    }

    /**
     * Draw UI elements (score, lives, level) using sprite text
     */
    drawUI(scoreManager, levelManager) {
        // Score (left)
        this.drawText('1UP', 4, 10, {
            color: COLORS.TEXT_RED,
            scale: 1,
            align: 'left',
        });
        this.drawText(`${scoreManager.score}`.padStart(2, '0'), 4, 20, {
            scale: 1,
            align: 'left',
        });

        // Lives (bottom-left row, horizontally flipped)
        if (this.spritesLoaded) {
            const bottomY = CANVAS_HEIGHT - TILE_SIZE;
            for (let i = 1; i < scoreManager.lives; i++) {
                const x = (i - 1) * TILE_SIZE;
                const y = bottomY;
                // Draw flipped horizontally
                this.drawSprite(
                    'player_digging_horizontal_1',
                    x,
                    y,
                    TILE_SIZE,
                    TILE_SIZE,
                    true, // flipH
                    false
                );
            }
        }

        this.drawHiScore(scoreManager);

        // Round indicator (bottom-right row)
        this.drawText(
            `ROUND ${levelManager.currentLevel}`,
            CANVAS_WIDTH - 4,
            CANVAS_HEIGHT - TILE_SIZE / 2 + 3,
            {
                scale: 1,
                align: 'right',
            }
        );

        this.drawLevelIndicators(levelManager.currentLevel);
    }

    drawHiScore(scoreManager) {
        // Hi-score (center)
        this.drawText('HI-SCORE', CANVAS_WIDTH / 2, 10, {
            color: COLORS.TEXT_RED,
            scale: 1,
            align: 'center',
        });
        this.drawText(
            `${scoreManager.highScore}`.padStart(2, '0'),
            CANVAS_WIDTH / 2,
            20,
            {
                scale: 1,
                align: 'center',
            }
        );
    }

    drawLevelIndicators(level) {
        if (!this.spritesLoaded) return;

        const size = TILE_SIZE;

        // Check sprite existence
        if (!this.sprites['flower_small']) return;

        // Bitwise Math for integer division (faster than Math.floor)
        const largeCount = (level / 10) | 0;
        const smallCount = level % 10;

        let xPos = CANVAS_WIDTH;

        // --- Draw Large Flowers ---
        // Order: large_1 first (rightmost), then alternate large_2, large_1, large_2...
        // Since we draw right-to-left, we need to reverse the alternation pattern
        if (
            largeCount > 0 &&
            this.sprites['flower_large_1'] &&
            this.sprites['flower_large_2']
        ) {
            for (let i = 0; i < largeCount; i++) {
                xPos -= size;

                // Reverse index so large_1 is always first (rightmost)
                // i=0 (rightmost) -> large_1, i=1 -> large_2, i=2 -> large_1, etc.
                const reverseIndex = largeCount - 1 - i;
                const spriteName =
                    reverseIndex & 1 ? 'flower_large_2' : 'flower_large_1';

                this.drawSprite(spriteName, xPos, size, size, size);
            }
        }

        // --- Draw Small Flowers ---
        for (let i = 0; i < smallCount; i++) {
            xPos -= size;
            this.drawSprite('flower_small', xPos, size, size, size);
        }
    }

    /**
     * Get the sprite name for a character
     * @param {string} char - Single character
     * @returns {string|null} - Sprite name or null if not available
     */
    getLetterSprite(char) {
        if (char >= '0' && char <= '9') return `letter_${char}`;
        if (char >= 'A' && char <= 'Z') return `letter_${char}`;
        if (char >= 'a' && char <= 'z') return `letter_${char.toUpperCase()}`;
        if (char === '.') return 'letter_period';
        if (char === '!') return 'letter_bang';
        if (char === '-') return 'letter_hyphen';
        if (char === "'") return 'letter_apostrophe';
        if (char === '▶') return 'letter_caret_right';
        if (char === '©') return 'letter_copy';
        // Space and unsupported chars return null (will just add spacing)
        return null;
    }

    getTintedSprite(image, color) {
        const offscreen = document.createElement('canvas');
        offscreen.width = image.width;
        offscreen.height = image.height;
        const ctx = offscreen.getContext('2d');

        // 1. Draw the original sprite
        ctx.drawImage(image, 0, 0);

        // 2. Overlay the color
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, offscreen.width, offscreen.height);

        return offscreen;
    }

    /**
     * Draw text using sprite letters from the spritesheet
     * @param {string} text - Text to render
     * @param {number} x - X position
     * @param {number} y - Y position (top of text, unlike canvas which uses baseline)
     * @param {Object} options - Rendering options
     * @param {number} options.scale - Scale factor (default 1)
     * @param {number} options.spacing - Extra spacing between letters (default 1)
     * @param {string} options.align - 'left', 'center', or 'right' (default 'left')
     * @param {string} options.color
     */
    drawText(text, x, y, options = {}) {
        if (!this.spritesLoaded || !this.spritesheet) return;

        let sheet = this.spritesheet;
        const scale = options.scale ?? 1;
        const spacing = options.spacing ?? 1;
        const align = options.align ?? 'left';

        if (options.color) {
            sheet = this.getTintedSprite(sheet, options.color);
        }

        // Calculate total width for alignment
        let totalWidth = 0;
        for (const char of text) {
            if (char === ' ') {
                totalWidth += 5 * scale + spacing; // Space width
            } else {
                const spriteName = this.getLetterSprite(char);
                const sprite = spriteName ? this.sprites[spriteName] : null;
                if (sprite) {
                    totalWidth += sprite.width * scale + spacing;
                } else {
                    // Unknown char - use default width
                    totalWidth += 7 * scale + spacing;
                }
            }
        }
        // Remove trailing spacing
        totalWidth -= spacing;

        // Adjust starting X based on alignment
        let drawX = x;
        if (align === 'center') drawX = x - totalWidth / 2;
        else if (align === 'right') drawX = x - totalWidth;

        // Adjust Y to account for the difference between canvas text baseline and sprite top
        // The original drawText used baseline positioning, sprites use top-left
        // Approximate adjustment based on typical font size to sprite size ratio
        const adjustedY = y - 7 * scale;

        // Draw each character
        for (const char of text) {
            if (char === ' ') {
                drawX += 5 * scale + spacing;
                continue;
            }

            const spriteName = this.getLetterSprite(char);
            const sprite = spriteName ? this.sprites[spriteName] : null;

            if (sprite) {
                const drawWidth = sprite.width * scale;
                const drawHeight = sprite.height * scale;

                this.ctx.drawImage(
                    sheet,
                    sprite.x,
                    sprite.y,
                    sprite.width,
                    sprite.height,
                    Math.round(drawX),
                    Math.round(adjustedY),
                    drawWidth,
                    drawHeight
                );

                drawX += drawWidth + spacing;
            } else {
                // Unknown char - skip with default width
                drawX += 7 * scale + spacing;
            }
        }
    }

    /**
     * Render respawning state with "Player 1 Ready" overlay
     */
    renderRespawning() {
        // Note: Game.js should call this.render() first, then this overlay
        // Overlay "Player 1 Ready" message
        this.drawText(
            'PLAYER 1',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 - TILE_SIZE / 2 - 3,
            {
                scale: 1,
                align: 'center',
            }
        );
        // Note: Exclamation mark not available in sprite font, using "READY" instead
        this.drawText(
            'READY!',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + TILE_SIZE + 3,
            {
                scale: 1,
                align: 'center',
            }
        );
    }

    /**
     * Draw debug information
     */
    drawDebugInfo(player, enemies) {
        // Draw grid lines
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;

        for (let x = 0; x <= CANVAS_WIDTH; x += TILE_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, CANVAS_HEIGHT);
            this.ctx.stroke();
        }

        for (let y = 0; y <= CANVAS_HEIGHT; y += TILE_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(CANVAS_WIDTH, y);
            this.ctx.stroke();
        }

        // Draw player hitbox
        if (player) {
            this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            this.ctx.strokeRect(player.x, player.y, TILE_SIZE, TILE_SIZE);
        }

        // Draw enemy hitboxes
        enemies.forEach((enemy) => {
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.strokeRect(enemy.x, enemy.y, TILE_SIZE, TILE_SIZE);
        });
    }
}
