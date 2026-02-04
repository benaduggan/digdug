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
import spriteMapData from './utils/sprite_map.json';
import spritesheetUrl from '../assets/sprites/spritesheet.png';

export class Renderer {
    constructor(config) {
        this.config = config;
        this.canvas = document.createElement('canvas');
        Object.assign(this.canvas.style, {
            imageRendering: 'pixelated',
            border: '1px solid #333',
        });
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

        // Menu animation state
        this.menuAnimationStartTime = null;
        this.menuAnimationDuration = 3000; // 3 seconds to slide up
        this.menuAnimationComplete = false;

        // Pre-allocated reusable object for color calculations (avoids GC pressure)
        this._colorResult = { h: 0, s: 0, l: 0 };

        // HSL string cache to avoid repeated string building
        this._hslCache = new Map();
        this._hslCacheMaxSize = 256;

        // Tinted sprite cache
        this._tintedSpriteCache = new Map();
    }

    /**
     * Load spritesheet and sprite map
     */
    async loadSprites() {
        try {
            // Load spritesheet image using the imported URL (bundled by Vite)
            this.spritesheet = await loadImage(spritesheetUrl);

            // Convert imported sprite map array to lookup object by name
            this.sprites = {};
            spriteMapData.forEach((sprite) => {
                this.sprites[sprite.name] = sprite;
            });

            this.spritesLoaded = true;
        } catch (error) {
            console.error('Failed to load spritesheet:', error);
        }
    }

    /**
     * Internal helper for sprite drawing with flipping
     * @private
     */
    _drawSpriteInternal(sprite, x, y, w, h, flipH, flipV) {
        const ctx = this.ctx;
        const sheet = this.spritesheet;

        if (flipH || flipV) {
            ctx.save();
            ctx.translate(x + w / 2, y + h / 2);
            ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
            ctx.drawImage(
                sheet,
                sprite.x,
                sprite.y,
                sprite.width,
                sprite.height,
                -w / 2,
                -h / 2,
                w,
                h
            );
            ctx.restore();
        } else {
            ctx.drawImage(
                sheet,
                sprite.x,
                sprite.y,
                sprite.width,
                sprite.height,
                x,
                y,
                w,
                h
            );
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
        if (!this.spritesLoaded) return false;

        const sprite = this.sprites[name];
        if (!sprite) return false;

        this._drawSpriteInternal(
            sprite,
            x,
            y,
            width ?? sprite.width,
            height ?? sprite.height,
            flipH,
            flipV
        );
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
        if (!this.spritesLoaded) return false;

        const sprite = this.sprites[name];
        if (!sprite) return false;

        const halfW = sprite.width / 2;
        const halfH = sprite.height / 2;
        this._drawSpriteInternal(
            sprite,
            centerX - halfW,
            centerY - halfH,
            sprite.width,
            sprite.height,
            flipH,
            flipV
        );
        return true;
    }

    /**
     * Attach canvas to DOM container
     */
    attachTo(container) {
        container.appendChild(this.canvas);
    }

    /**
     * Start the menu slide-up animation
     */
    startMenuAnimation() {
        this.menuAnimationStartTime = performance.now();
        this.menuAnimationComplete = false;
    }

    /**
     * Skip the menu animation and show the final state
     */
    skipMenuAnimation() {
        this.menuAnimationComplete = true;
    }

    /**
     * Reset menu animation state (call when leaving menu)
     */
    resetMenuAnimation() {
        this.menuAnimationStartTime = null;
        this.menuAnimationComplete = false;
    }

    /**
     * Check if menu animation is still playing
     */
    isMenuAnimating() {
        return (
            this.menuAnimationStartTime !== null && !this.menuAnimationComplete
        );
    }

    drawMenu(scoreManager) {
        const { ctx, sprites, spritesheet, spritesLoaded } = this;
        if (!spritesLoaded || !spritesheet) return;

        // Calculate animation offset
        let offsetY = 0;
        if (
            this.menuAnimationStartTime !== null &&
            !this.menuAnimationComplete
        ) {
            const elapsed = performance.now() - this.menuAnimationStartTime;
            const progress = Math.min(1, elapsed / this.menuAnimationDuration);

            // Linear animation
            offsetY = CANVAS_HEIGHT * (1 - progress);

            if (progress >= 1) {
                this.menuAnimationComplete = true;
                offsetY = 0;
            }
        }

        this.drawHiScore(scoreManager, offsetY);

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
                (dy + offsetY) | 0,
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

        // Draw "1 PLAYER" text (always visible)
        const playerTextY = ((CANVAS_HEIGHT * 0.8) | 0) + offsetY;
        this.drawText('1 PLAYER', (CANVAS_WIDTH / 2) | 0, playerTextY, {
            scale: 1,
            align: 'center',
        });

        // Draw flashing "▶" character (flashes every 500ms)
        const caretVisible = Math.floor(performance.now() / 500) % 2 === 0;
        if (caretVisible) {
            const caretX = ((CANVAS_WIDTH / 2) | 0) - 40;
            this.drawText('▶', caretX, playerTextY, {
                scale: 1,
                align: 'left',
            });
        }

        // Namco Logo & Copyright
        const namco = sprites['namco'];
        if (namco)
            draw('namco', (CANVAS_WIDTH - namco.width) / 2, CANVAS_HEIGHT - 24);

        this.drawText(
            '© 1982 NAMCO LTD.',
            (CANVAS_WIDTH / 2) | 0,
            ((CANVAS_HEIGHT - 5) | 0) + offsetY,
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
     * OPTIMIZED: Inline checks, reuse result object
     */
    getEmptyTileNeighbors(grid, x, y) {
        const bottomUIRow = grid.height - 1;
        const yAbove = y - 1;
        const yBelow = y + 1;
        const xLeft = x - 1;
        const xRight = x + 1;
        const notSky = y > 1;

        // Inline the dirt check: bottom UI row acts as solid, otherwise check isEmpty
        const topDirt =
            notSky && (yAbove === bottomUIRow || !grid.isEmpty(x, yAbove));
        const bottomDirt = yBelow === bottomUIRow || !grid.isEmpty(x, yBelow);
        const leftDirt = !grid.isEmpty(xLeft, y);
        const rightDirt = !grid.isEmpty(xRight, y);

        return {
            top: topDirt,
            bottom: bottomDirt,
            left: leftDirt,
            right: rightDirt,
            // Diagonals for corner detection
            topLeft:
                notSky &&
                (yAbove === bottomUIRow || !grid.isEmpty(xLeft, yAbove)),
            topRight:
                notSky &&
                (yAbove === bottomUIRow || !grid.isEmpty(xRight, yAbove)),
            bottomLeft: yBelow === bottomUIRow || !grid.isEmpty(xLeft, yBelow),
            bottomRight:
                yBelow === bottomUIRow || !grid.isEmpty(xRight, yBelow),
        };
    }

    /**
     * Get HSL string from cache or build it
     * @param {number} h - Hue
     * @param {number} s - Saturation
     * @param {number} l - Lightness
     * @returns {string} - HSL color string
     */
    _getHslString(h, s, l) {
        // Pack h, s, l into a single key (h is 0-360, s and l are 0-100)
        const key = (h << 14) | (s << 7) | l;
        let cached = this._hslCache.get(key);
        if (cached === undefined) {
            cached = `hsl(${h}, ${s}%, ${l}%)`;
            // Limit cache size
            if (this._hslCache.size >= this._hslCacheMaxSize) {
                // Clear oldest entries (simple strategy)
                const firstKey = this._hslCache.keys().next().value;
                this._hslCache.delete(firstKey);
            }
            this._hslCache.set(key, cached);
        }
        return cached;
    }

    getDirtColorHSL(ratio, currentLevel) {
        // Clamp ratio between 0 and 1
        const r = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
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
        const range = upper.stop - lower.stop;

        // Linear Interpolation (Lerp) the H, S, and L values
        // Note: If Range is 0 (end of array), avoid divide by zero
        // Reuse pre-allocated object to avoid GC pressure
        const result = this._colorResult;
        if (range === 0) {
            result.h = upper.color.h;
            result.s = upper.color.s;
            result.l = upper.color.l;
        } else {
            const mixPercent = (r - lower.stop) / range;
            result.h =
                (lower.color.h +
                    (upper.color.h - lower.color.h) * mixPercent +
                    0.5) |
                0;
            result.s =
                (lower.color.s +
                    (upper.color.s - lower.color.s) * mixPercent +
                    0.5) |
                0;
            result.l =
                (lower.color.l +
                    (upper.color.l - lower.color.l) * mixPercent +
                    0.5) |
                0;
        }
        return result;
    }

    /**
     * Draw pixel edges for an empty tile
     * OPTIMIZED: Batches all geometry into a single draw call
     */
    drawTunnelEdges(ctx, px, py, neighbors, depthRatio, currentLevel) {
        // 1. Set style once (using cached HSL string)
        const { h, s, l } = this.getDirtColorHSL(depthRatio, currentLevel);
        ctx.fillStyle = this._getHslString(h, s, l);

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
     * OPTIMIZED: Uses numeric side codes and unrolled loops
     */
    addTunnelEdgePath(ctx, px, py, side) {
        const size = TILE_SIZE;
        // Unroll loops for common tile size of 16 (4 iterations)
        if (side === 'top') {
            ctx.rect(px + 1, py, 2, 1);
            ctx.rect(px + 5, py, 2, 1);
            ctx.rect(px + 9, py, 2, 1);
            ctx.rect(px + 13, py, 2, 1);
        } else if (side === 'bottom') {
            const yPos = py + size - 1;
            ctx.rect(px + 1, yPos, 2, 1);
            ctx.rect(px + 5, yPos, 2, 1);
            ctx.rect(px + 9, yPos, 2, 1);
            ctx.rect(px + 13, yPos, 2, 1);
        } else if (side === 'left') {
            ctx.rect(px, py + 1, 1, 2);
            ctx.rect(px, py + 5, 1, 2);
            ctx.rect(px, py + 9, 1, 2);
            ctx.rect(px, py + 13, 1, 2);
        } else {
            // right
            const xPos = px + size - 1;
            ctx.rect(xPos, py + 1, 1, 2);
            ctx.rect(xPos, py + 5, 1, 2);
            ctx.rect(xPos, py + 9, 1, 2);
            ctx.rect(xPos, py + 13, 1, 2);
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

                    // 1. Get Calculated HSL (reuses internal object)
                    const { h, s, l } = this.getDirtColorHSL(
                        depthRatio,
                        currentLevel
                    );

                    // 2. Draw Base (using cached HSL string)
                    ctx.fillStyle = this._getHslString(h, s, l);
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

                    // 3. Boost Saturation for Specs (using cached HSL strings)
                    // Shadow: Darker (-15%) and Richer (+20% Saturation)
                    const shadowS = s + 20 > 100 ? 100 : s + 20;
                    const shadowL = l - 15 < 0 ? 0 : l - 15;

                    // Highlight: Brighter (+10%) and Richer (+10% Saturation)
                    const lightS = s + 10 > 100 ? 100 : s + 10;
                    const lightL = l + 10 > 100 ? 100 : l + 10;

                    // Pre-compute base coordinates for this tile
                    const baseX = x * TILE_SIZE;
                    const baseY = y * TILE_SIZE;

                    // 4. Texture Loop (Spread out 4px grid) - unrolled for 16x16 tile
                    // --- PASS 1: Saturated Shadows ---
                    ctx.fillStyle = this._getHslString(h, shadowS, shadowL);
                    for (let dy = 0; dy < TILE_SIZE; dy += 4) {
                        const seedY = baseY + dy;
                        for (let dx = 0; dx < TILE_SIZE; dx += 4) {
                            const seedX = baseX + dx;
                            // Simplified noise calculation
                            const noise =
                                (Math.sin(seedX * 12.989 + seedY * 78.233) *
                                    43758.545) %
                                1;
                            if (noise > 0 ? noise < 0.15 : noise > -0.15) {
                                ctx.fillRect(px + dx + 1, py + dy + 1, 2, 2);
                            }
                        }
                    }

                    // --- PASS 2: Vibrant Highlights ---
                    ctx.fillStyle = this._getHslString(h, lightS, lightL);
                    for (let dy = 0; dy < TILE_SIZE; dy += 4) {
                        const seedY = baseY + dy;
                        for (let dx = 0; dx < TILE_SIZE; dx += 4) {
                            const seedX = baseX + dx;
                            const noise =
                                (Math.sin(seedX * 90.123 + seedY * 11.456) *
                                    12345.678) %
                                1;
                            if (noise > 0 ? noise < 0.08 : noise > -0.08) {
                                ctx.fillRect(px + dx + 1, py + dy + 1, 2, 2);
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
            let segments = -diffY - 1;

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
            let segments = diffY - 1;

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
            let segments = -diffX - 1;

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
            let segments = diffX - 1;

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
     * OPTIMIZED: Reduced string concatenation, early type check
     */
    drawEnemy(enemy) {
        if (!this.spritesLoaded) return;

        // Optimization: Bitwise OR 0 truncates decimals faster than Math.floor
        // and ensures we don't render on sub-pixels (blurry edges).
        const halfTile = TILE_SIZE / 2;
        const centerX = (enemy.x + halfTile) | 0;
        const centerY = (enemy.y + halfTile) | 0;
        const type = enemy.type;
        const flipH = enemy.spriteFlipH;

        // 1. Smooshed
        if (enemy.isSmooshed) {
            this.drawSpriteCentered(
                `${type}_smooshed`,
                centerX,
                centerY,
                flipH
            );
            return;
        }

        // 2. Popped
        if (enemy.isPopped) {
            this.drawSpriteCentered(`${type}_popped`, centerX, centerY, flipH);
            return;
        }

        // 3. Inflating
        if (enemy.inflateLevel > 1.0) {
            // Optimization: Map 1.0-2.0 range to integers 1, 2, 3 using bitwise
            let stage = ((enemy.inflateLevel - 1.0) * 3 + 1) | 0;
            // Clamp to 1-3 range
            stage = stage < 1 ? 1 : stage > 3 ? 3 : stage;

            this.drawSpriteCentered(
                `${type}_inflating_${stage}`,
                centerX,
                centerY,
                flipH
            );
            return;
        }

        // 4. Normal Walking / Ghosting / Fire Logic
        const frameNumber = enemy.animationFrame === 0 ? '1' : '2';
        const state = enemy.isGhosting ? 'ghosting' : 'walking';
        const isFygar = type === ENEMY_TYPES.FYGAR;

        // Default flip, with Fygar override for fire direction
        const renderFlip =
            isFygar && enemy.fireDirection
                ? enemy.fireDirection === DIRECTIONS.RIGHT
                : flipH;

        this.drawSpriteCentered(
            `${type}_${state}_${frameNumber}`,
            centerX,
            centerY,
            renderFlip
        );

        // 5. Fire Effects (Fygar only)
        if (isFygar) {
            const fState = enemy.fireState;
            if (fState === 'charging') {
                this.drawFygarCharging(enemy);
            } else if (fState === 'firing') {
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
    drawBonusItem(item) {
        if (!this.spritesLoaded) return;

        const px = item.x;
        const py = item.y;

        // If flashing, toggle visibility every 100ms
        if (item.isFlashing && item.isFlashing()) {
            const flashVisible = Math.floor(item.elapsedTime / 100) % 2 === 0;
            if (!flashVisible) return; // Skip rendering on flash-off frames
        }

        const spriteName = `prize_${item.prizeIndex + 1}`;
        this.drawSprite(spriteName, px, py, TILE_SIZE, TILE_SIZE);
    }

    /**
     * Draw floating score displays
     * OPTIMIZED: Use for loop, cache sheet reference
     */
    drawFloatingScores(floatingScores) {
        if (!this.spritesLoaded) return;

        const sheet = this.spritesheet;
        const ctx = this.ctx;
        const sprites = this.sprites;
        const halfTile = TILE_SIZE / 2;

        for (let i = 0, len = floatingScores.length; i < len; i++) {
            const score = floatingScores[i];
            const sprite = sprites[`score_${score.points}`];
            if (!sprite) continue;

            // Center the score sprite on the position, use bitwise for rounding
            const drawX = (score.x + halfTile - sprite.width / 2 + 0.5) | 0;
            const drawY = (score.y + halfTile - sprite.height / 2 + 0.5) | 0;

            ctx.drawImage(
                sheet,
                sprite.x,
                sprite.y,
                sprite.width,
                sprite.height,
                drawX,
                drawY,
                sprite.width,
                sprite.height
            );
        }
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

    drawHiScore(scoreManager, offsetY = 0) {
        // Hi-score (center)
        this.drawText('HI-SCORE', CANVAS_WIDTH / 2, 10 + offsetY, {
            color: COLORS.TEXT_RED,
            scale: 1,
            align: 'center',
        });
        this.drawText(
            `${scoreManager.highScore}`.padStart(2, '0'),
            CANVAS_WIDTH / 2,
            20 + offsetY,
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
        // Check cache first
        const cached = this._tintedSpriteCache.get(color);
        if (cached) return cached;

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

        // Cache the result
        this._tintedSpriteCache.set(color, offscreen);
        return offscreen;
    }

    /**
     * Draw text using sprite letters from the spritesheet
     * OPTIMIZED: Single pass through text, pre-lookup sprites
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

        const scale = options.scale ?? 1;
        const spacing = options.spacing ?? 1;
        const align = options.align ?? 'left';
        const sheet = options.color
            ? this.getTintedSprite(this.spritesheet, options.color)
            : this.spritesheet;

        const spaceWidth = 5 * scale + spacing;
        const defaultWidth = 7 * scale + spacing;
        const textLen = text.length;

        // Pre-lookup all sprites and calculate total width in one pass
        // Use a small array to store sprite references (avoids re-lookup in draw pass)
        const spriteRefs = new Array(textLen);
        let totalWidth = 0;

        for (let i = 0; i < textLen; i++) {
            const char = text[i];
            if (char === ' ') {
                spriteRefs[i] = null;
                totalWidth += spaceWidth;
            } else {
                const spriteName = this.getLetterSprite(char);
                const sprite = spriteName ? this.sprites[spriteName] : null;
                spriteRefs[i] = sprite;
                totalWidth += sprite
                    ? sprite.width * scale + spacing
                    : defaultWidth;
            }
        }
        // Remove trailing spacing
        totalWidth -= spacing;

        // Adjust starting X based on alignment
        let drawX =
            align === 'center'
                ? x - totalWidth / 2
                : align === 'right'
                  ? x - totalWidth
                  : x;

        // Adjust Y to account for the difference between canvas text baseline and sprite top
        const adjustedY = (y - 7 * scale + 0.5) | 0;
        const ctx = this.ctx;

        // Draw each character using pre-looked-up sprites
        for (let i = 0; i < textLen; i++) {
            const char = text[i];
            if (char === ' ') {
                drawX += spaceWidth;
                continue;
            }

            const sprite = spriteRefs[i];
            if (sprite) {
                const drawWidth = sprite.width * scale;
                const drawHeight = sprite.height * scale;

                ctx.drawImage(
                    sheet,
                    sprite.x,
                    sprite.y,
                    sprite.width,
                    sprite.height,
                    (drawX + 0.5) | 0,
                    adjustedY,
                    drawWidth,
                    drawHeight
                );

                drawX += drawWidth + spacing;
            } else {
                // Unknown char - skip with default width
                drawX += defaultWidth;
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
            CANVAS_HEIGHT / 2 + TILE_SIZE + 2,
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
