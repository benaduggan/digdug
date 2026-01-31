import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    TILE_SIZE,
    COLORS,
    TILE_TYPES,
    DIRECTIONS,
    DEATH,
    ENEMY_TYPES,
    DIRT_GRADIENT,
} from './utils/constants.js';
import { loadImage } from './utils/loadImage.js';

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

        // Sprite cache
        this.sprites = {};
        this.spritesLoaded = false;
        this.loadSprites();

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
     * Load sprite images
     */
    loadSprites() {
        const spriteFiles = [
            'player_walking_horizontal_1.png',
            'player_walking_horizontal_2.png',
            'player_walking_vertical_1.png',
            'player_walking_vertical_2.png',
            'player_digging_horizontal_1.png',
            'player_digging_horizontal_2.png',
            'player_digging_vertical_1.png',
            'player_digging_vertical_2.png',
            'player_shooting_horizontal.png',
            'player_shooting_vertical.png',
            'player_pumping_horizontal_1.png',
            'player_pumping_horizontal_2.png',
            'player_pumping_vertical_1.png',
            'player_pumping_vertical_2.png',
            'player_smooshed_horizontal.png',
            'player_smooshed_vertical.png',
            'player_dying_horizontal_1.png',
            'player_dying_horizontal_2.png',
            'player_dying_horizontal_3.png',
            'player_dying_horizontal_4.png',
            'player_dying_horizontal_5.png',
            'player_dying_vertical_1.png',
            'player_dying_vertical_2.png',
            'player_dying_vertical_3.png',
            'player_dying_vertical_4.png',
            'player_dying_vertical_5.png',
            'hose_line_horizontal.png',
            'hose_line_vertical.png',
            'hose_nozzle_horizontal.png',
            'hose_nozzle_vertical.png',
            'pooka_walking_1.png',
            'pooka_walking_2.png',
            'pooka_ghosting_1.png',
            'pooka_ghosting_2.png',
            'fygar_walking_1.png',
            'fygar_walking_2.png',
            'fygar_ghosting_1.png',
            'fygar_ghosting_2.png',
            'fygar_fire_1.png',
            'fygar_fire_2.png',
            'fygar_fire_3.png',
            'pooka_inflating_1.png',
            'pooka_inflating_2.png',
            'pooka_inflating_3.png',
            'pooka_popped.png',
            'pooka_smooshed.png',
            'fygar_inflating_1.png',
            'fygar_inflating_2.png',
            'fygar_inflating_3.png',
            'fygar_popped.png',
            'fygar_smooshed.png',
            'rock_1.png',
            'rock_2.png',
            'rock_crumbling_1.png',
            'rock_crumbling_2.png',
            'flower_small.png',
        ];

        let loadedCount = 0;
        const totalSprites = spriteFiles.length;

        spriteFiles.forEach((filename) => {
            const img = new Image();
            img.onload = () => {
                loadedCount++;
                if (loadedCount === totalSprites) {
                    this.spritesLoaded = true;
                }
            };
            img.onerror = () => {
                console.warn(`Failed to load sprite: ${filename}`);
                loadedCount++;
                if (loadedCount === totalSprites) {
                    this.spritesLoaded = true;
                }
            };
            const spriteName = filename.replace('.png', '');
            img.src = `/assets/sprites/${filename}`;
            this.sprites[spriteName] = img;
        });
    }

    /**
     * Attach canvas to DOM container
     */
    attachTo(container) {
        container.appendChild(this.canvas);
    }

    async drawMenu() {
        const img = await loadImage('/assets/sprites/dig_dug_title.png');
        const width = img.naturalWidth * 1.5;
        this.ctx.drawImage(
            img,
            CANVAS_WIDTH / 2 - width / 2,
            TILE_SIZE * 2,
            width,
            img.naturalHeight * 1.5
        );

        this.drawText(
            '▶ 1 PLAYER',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + TILE_SIZE * 6,
            {
                size: 8,
                color: COLORS.TEXT_WHITE,
                align: 'center',
            }
        );

        // this.drawText(
        //     'ARROWS -> MOVE // SPACE -> PUMP // ESC -> PAUSE',
        //     CANVAS_WIDTH / 2,
        //     CANVAS_HEIGHT / 2 + TILE_SIZE * 8,
        //     {
        //         size: 5,
        //         color: COLORS.TEXT_WHITE,
        //         align: 'center',
        //     }
        // );
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
    drawGrid(grid) {
        // Check if grid state changed (simple hash of tunnel positions)
        const currentGridState = grid.getStateHash ? grid.getStateHash() : null;
        if (currentGridState !== this.lastGridState) {
            this.backgroundDirty = true;
            this.lastGridState = currentGridState;
        }

        // Rebuild background cache if dirty
        if (this.backgroundDirty) {
            this.renderBackgroundToCache(grid);
            this.backgroundDirty = false;
        }

        // Draw cached background in one operation
        this.ctx.drawImage(this.backgroundCanvas, 0, 0);
    }

    getDirtColorHSL(ratio) {
        // Clamp ratio between 0 and 1
        const r = Math.max(0, Math.min(1, ratio));

        // Find the two colors we are between (e.g., Light and Mid)
        let lower = DIRT_GRADIENT[0];
        let upper = DIRT_GRADIENT[DIRT_GRADIENT.length - 1];

        for (let i = 0; i < DIRT_GRADIENT.length - 1; i++) {
            if (r >= DIRT_GRADIENT[i].stop && r <= DIRT_GRADIENT[i + 1].stop) {
                lower = DIRT_GRADIENT[i];
                upper = DIRT_GRADIENT[i + 1];
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
     * Render the full background to the cache canvas
     * Called only when grid changes
     */
    renderBackgroundToCache(grid) {
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

                if (tile === TILE_TYPES.DIRT || tile === TILE_TYPES.ROCK) {
                    const depthRatio = (y - 2) / (grid.height - 2);

                    // 1. Get Calculated HSL
                    const { h, s, l } = this.getDirtColorHSL(depthRatio);

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
                }
                // Empty tiles are just the background color (already cleared)
            }
        }
    }

    /**
     * Get dirt color based on depth
     */
    getDirtColor(depthRatio) {
        if (depthRatio < 0.25) return COLORS.DIRT_LIGHT;
        if (depthRatio < 0.5) return COLORS.DIRT_MID;
        if (depthRatio < 0.75) return COLORS.DIRT_DARK;
        return COLORS.DIRT_DARKEST;
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

        // Use sprites if loaded, otherwise fallback to simple square
        if (this.spritesLoaded) {
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

            const sprite =
                this.sprites[
                    `player_${spriteAction}_${orientation}${frameNumber}`
                ];

            if (sprite && sprite.complete) {
                // Only use save/restore if we need to flip
                const needsFlip = player.spriteFlipH || player.spriteFlipV;

                if (needsFlip) {
                    const centerX = px + TILE_SIZE / 2;
                    const centerY = py + TILE_SIZE / 2;
                    this.drawFlippedSprite(
                        centerX,
                        centerY,
                        player.spriteFlipH,
                        player.spriteFlipV,
                        sprite
                    );
                } else {
                    // No flip needed - draw directly without save/restore
                    this.ctx.drawImage(sprite, px, py, TILE_SIZE, TILE_SIZE);
                }
            } else {
                // Fallback to simple blue square
                this.ctx.fillStyle = '#3498db';
                this.ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            }
        } else {
            // Fallback to simple blue square while sprites are loading
            this.ctx.fillStyle = '#3498db';
            this.ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }
    }

    /**
     * Draw a horizontally or vertically flipped sprite
     * at TILE_SIZE width and height
     */
    drawFlippedSprite(centerX, centerY, flipH, flipV, sprite) {
        this.ctx.save();
        this.ctx.translate(centerX, centerY);
        this.ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        this.ctx.drawImage(
            sprite,
            -TILE_SIZE / 2,
            -TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE
        );
        this.ctx.restore();
    }

    /**
     * Draw player death animation
     */
    drawPlayerDeath(player) {
        const px = player.x;
        const py = player.y;
        const orientation = this.getPlayerOrientation(player);

        // If smooshed and still falling with rock OR waiting for delay, show smooshed sprite
        if (
            player.isSmooshed &&
            (player.attachedToRock?.isFalling ||
                player.smooshedDelayTimer < player.SMOOSHED_DELAY)
        ) {
            const spriteKey = `player_smooshed_${orientation}`;
            if (this.spritesLoaded) {
                const sprite = this.sprites[spriteKey];
                if (sprite && sprite.complete) {
                    if (player.spriteFlipH) {
                        const centerX = px + TILE_SIZE / 2;
                        const centerY = py + TILE_SIZE / 2;
                        this.drawFlippedSprite(
                            centerX,
                            centerY,
                            true,
                            false,
                            sprite
                        );
                    } else {
                        this.ctx.drawImage(
                            sprite,
                            px,
                            py,
                            TILE_SIZE,
                            TILE_SIZE
                        );
                    }
                    return;
                }
            }
        }

        // Death animation
        const progress = player.deathTimer / DEATH.ANIMATION_DURATION;
        // Calculate frame number (1-5) based on progress
        const frameNumber = Math.min(5, Math.floor(progress * 5) + 1);
        const spriteKey = `player_dying_${orientation}_${frameNumber}`;

        if (this.spritesLoaded) {
            const sprite = this.sprites[spriteKey];
            if (sprite && sprite.complete) {
                // Apply horizontal flip if needed, but never vertical flip
                if (player.spriteFlipH) {
                    const centerX = px + TILE_SIZE / 2;
                    const centerY = py + TILE_SIZE / 2;
                    this.drawFlippedSprite(
                        centerX,
                        centerY,
                        true,
                        false,
                        sprite
                    );
                } else {
                    this.ctx.drawImage(sprite, px, py, TILE_SIZE, TILE_SIZE);
                }
                return;
            }
        }
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
        const ctx = this.ctx;

        // 3. Resolve orientation and sprites immediately
        const orientation = this.getPlayerOrientation(player);
        const nozzleSprite = this.sprites[`hose_nozzle_${orientation}`];
        const lineSprite = this.sprites[`hose_line_${orientation}`];

        // Check validity before proceeding with math
        if (
            !nozzleSprite ||
            !nozzleSprite.complete ||
            !lineSprite ||
            !lineSprite.complete
        ) {
            return;
        }

        // 4. Calculate Grid Difference
        // startX/Y logic inlined here
        const diffX = Math.round((px + halfTile - endPoint.x) / TILE);
        const diffY = Math.round((py + halfTile - endPoint.y) / TILE);

        // Cache Flip states
        const flipH = player.spriteFlipH;
        const flipV = player.spriteFlipV;

        // Helper to calculate segments count (exclude the nozzle itself)
        // If diff is -2 (2 tiles away), we need 1 line segment. |diff| - 1.

        // --- DOWN (Player looking DOWN) ---
        if (diffY < 0) {
            let segments = Math.abs(diffY) - 1;

            if (flipH) {
                const dx = px + halfTile;
                let dy = endPoint.y - TILE * 0.25;

                this.drawFlippedSprite(dx, dy, flipH, flipV, nozzleSprite);

                while (segments > 0) {
                    dy -= TILE;
                    this.drawFlippedSprite(dx, dy, flipH, flipV, lineSprite);
                    segments--;
                }
            } else {
                const dx = px;
                let dy = endPoint.y - TILE * 0.75;

                ctx.drawImage(nozzleSprite, dx, dy, TILE, TILE);

                while (segments > 0) {
                    dy -= TILE;
                    ctx.drawImage(lineSprite, dx, dy, TILE, TILE);
                    segments--;
                }
            }
            return;
        }

        // --- UP (Player looking UP) ---
        if (diffY > 0) {
            let segments = Math.abs(diffY) - 1;

            // Logic: UP always uses drawFlippedSprite
            const dx = px + halfTile;
            let dy = endPoint.y + TILE * 0.25;

            this.drawFlippedSprite(dx, dy, flipH, flipV, nozzleSprite);

            while (segments > 0) {
                dy += TILE;
                this.drawFlippedSprite(dx, dy, flipH, flipV, lineSprite);
                segments--;
            }
            return;
        }

        // --- RIGHT (Player looking RIGHT) ---
        if (diffX < 0) {
            let segments = Math.abs(diffX) - 1;

            // Logic: RIGHT always uses drawFlippedSprite
            let dx = endPoint.x - TILE * 0.25;
            const dy = py + halfTile;

            this.drawFlippedSprite(dx, dy, flipH, flipV, nozzleSprite);

            while (segments > 0) {
                dx -= TILE;
                this.drawFlippedSprite(dx, dy, flipH, flipV, lineSprite);
                segments--;
            }
            return;
        }

        // --- LEFT (Player looking LEFT) ---
        if (diffX > 0) {
            let segments = Math.abs(diffX) - 1;

            // Logic: LEFT always uses standard drawImage
            let dx = endPoint.x - TILE * 0.25;

            ctx.drawImage(nozzleSprite, dx, py, TILE, TILE);

            while (segments > 0) {
                dx += TILE;
                ctx.drawImage(lineSprite, dx, py, TILE, TILE);
                segments--;
            }
        }
    }

    /**
     * Draw an enemy with inflation, popped, and smooshed states
     */
    drawEnemy(enemy) {
        const px = enemy.x;
        const py = enemy.y;
        const centerX = px + TILE_SIZE / 2;
        const centerY = py + TILE_SIZE / 2;

        // Handle smooshed state (crushed by rock)
        if (enemy.isSmooshed) {
            this.drawEnemySmooshed(enemy, centerX, centerY);
            return;
        }

        // Handle popped state (after full inflation)
        if (enemy.isPopped) {
            this.drawEnemyPopped(enemy, centerX, centerY);
            return;
        }

        // Handle inflating state (being pumped)
        if (enemy.inflateLevel > 1.0) {
            this.drawEnemyInflating(enemy, centerX, centerY);
            return;
        }

        // Normal state - use walking/ghosting sprites
        if (this.spritesLoaded) {
            const frameNumber = enemy.animationFrame === 0 ? '1' : '2';
            const state = enemy.isGhosting ? 'ghosting' : 'walking';
            const sprite =
                this.sprites[`${enemy.type}_${state}_${frameNumber}`];

            this.drawEnemySprite(sprite, centerX, centerY, enemy.spriteFlipH);
        }

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
     * Draw enemy in inflating state using inflation sprites
     * Sprites: inflating_1 (first third), inflating_2 (second third), inflating_3 (final third)
     * Each sprite has its own size (16x16, 20x20, 21x21) - render at natural size
     */
    drawEnemyInflating(enemy, centerX, centerY) {
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
        const sprite = this.sprites[spriteName];

        this.drawEnemySprite(sprite, centerX, centerY, enemy.spriteFlipH);
    }

    /**
     * Draw enemy in popped state (after full inflation)
     */
    drawEnemyPopped(enemy, centerX, centerY) {
        const sprite = this.sprites[`${enemy.type}_popped`];
        this.drawEnemySprite(sprite, centerX, centerY, enemy.spriteFlipH);
    }

    /**
     * Helper to draw enemy sprite with flipping
     * and renders at natural size
     */
    drawEnemySprite(sprite, centerX, centerY, flipH) {
        if (sprite && sprite.complete) {
            const spriteWidth = sprite.naturalWidth;
            const spriteHeight = sprite.naturalHeight;

            this.ctx.save();
            this.ctx.translate(centerX, centerY);

            if (flipH) this.ctx.scale(-1, 1);

            this.ctx.drawImage(
                sprite,
                -spriteWidth / 2,
                -spriteHeight / 2,
                spriteWidth,
                spriteHeight
            );

            this.ctx.restore();
        }
    }

    /**
     * Draw enemy in smooshed state (crushed by rock)
     */
    drawEnemySmooshed(enemy, centerX, centerY) {
        const sprite = this.sprites[`${enemy.type}_smooshed`];
        this.drawEnemySprite(sprite, centerX, centerY, enemy.spriteFlipH);
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
        const fireHitbox = enemy.getFireHitbox();
        if (!fireHitbox) return;

        const direction = enemy.getFireDirection();
        const facingLeft = direction === DIRECTIONS.LEFT;

        // Get current fire length (1-3 tiles based on timer)
        const tileCount = enemy.getFireTileCount ? enemy.getFireTileCount() : 3;

        // Use the sprite that matches current fire length
        // fire_1 = 1 tile wide, fire_2 = 2 tiles wide, fire_3 = 3 tiles wide
        const sprite = this.sprites[`fygar_fire_${tileCount}`];

        if (sprite && sprite.complete) {
            this.ctx.save();

            // Sprite width is tileCount * TILE_SIZE
            const spriteWidth = tileCount * TILE_SIZE;

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
            const centerY = fireY + TILE_SIZE / 2;

            this.ctx.translate(centerX, centerY);

            // Flip horizontally if facing right (sprites are drawn facing left)
            if (!facingLeft) {
                this.ctx.scale(-1, 1);
            }

            // Draw sprite centered - use actual sprite dimensions
            this.ctx.drawImage(
                sprite,
                -spriteWidth / 2,
                -TILE_SIZE / 2,
                spriteWidth,
                TILE_SIZE
            );

            this.ctx.restore();
        } else {
            // Fallback to colored rectangles if sprite not loaded
            for (let i = 0; i < tileCount; i++) {
                this.drawFygarFireFallback(enemy, i, facingLeft);
            }
        }
    }

    /**
     * Fallback fire rendering if sprites not loaded
     */
    drawFygarFireFallback(enemy, segmentIndex, facingLeft) {
        const centerY = enemy.y + TILE_SIZE / 2;

        // Color gradient from yellow to red
        const colors = ['#ffff00', '#ff8800', '#ff3300'];
        this.ctx.fillStyle = colors[segmentIndex];

        let fireX;
        if (facingLeft) {
            fireX = enemy.x - (segmentIndex + 1) * TILE_SIZE;
        } else {
            fireX = enemy.x + TILE_SIZE + segmentIndex * TILE_SIZE;
        }

        // Draw flame rectangle
        const flameHeight = TILE_SIZE * 0.6;
        this.ctx.fillRect(
            fireX + 2,
            centerY - flameHeight / 2,
            TILE_SIZE - 4,
            flameHeight
        );
    }

    /**
     * Draw a rock with shaking and crumbling animations
     */
    drawRock(rock) {
        const px = rock.x;
        const py = rock.y;

        // Crumble animation - alternate between crumbling sprites
        if (rock.isCrumbling) {
            const progress = rock.crumbleTimer / rock.CRUMBLE_DURATION;
            // First half: crumbling_1, second half: crumbling_2
            const spriteKey =
                progress < 0.5 ? 'rock_crumbling_1' : 'rock_crumbling_2';

            if (this.spritesLoaded) {
                const sprite = this.sprites[spriteKey];
                if (sprite && sprite.complete) {
                    this.ctx.drawImage(sprite, px, py, TILE_SIZE, TILE_SIZE);
                    return;
                }
            }
            // Fallback: simple fading particles
            this.ctx.save();
            this.ctx.globalAlpha = 1 - progress;
            this.ctx.fillStyle = '#95a5a6';
            const offset = progress * 4;
            this.ctx.fillRect(px + 2 - offset, py + 3, 4, 4);
            this.ctx.fillRect(px + 10 + offset, py + 3, 4, 4);
            this.ctx.fillRect(px + 6, py + 8 + offset, 4, 4);
            this.ctx.restore();
            return;
        }

        // Calculate shake offset and determine sprite for shaking
        let spriteKey = 'rock_1';

        if (rock.isShaking) {
            // Alternate between rock_1 and rock_2 every 100ms while shaking
            spriteKey =
                Math.floor(rock.shakeTimer / 200) % 2 === 0
                    ? 'rock_1'
                    : 'rock_2';
        }

        if (this.spritesLoaded) {
            const sprite = this.sprites[spriteKey];
            if (sprite && sprite.complete) {
                this.ctx.drawImage(sprite, px, py, TILE_SIZE, TILE_SIZE);
            } else {
                this.drawRockFallback(px, py);
            }
        } else {
            this.drawRockFallback(px, py);
        }
    }

    drawRockFallback(px, py) {
        // Simple gray square for rock
        this.ctx.fillStyle = '#95a5a6';
        this.ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }

    /**
     * Draw bonus item
     */
    drawBonusItem(item) {
        const px = item.x;
        const py = item.y;

        // Draw simple bonus item (yellow circle/fruit)
        this.ctx.fillStyle = COLORS.TEXT_RED;
        this.ctx.beginPath();
        this.ctx.arc(
            px + TILE_SIZE / 2,
            py + TILE_SIZE / 2,
            TILE_SIZE / 3,
            0,
            Math.PI * 2
        );
        this.ctx.fill();

        // Pulsing effect
        const scale = 1 + Math.sin(Date.now() / 200) * 0.1;
        this.ctx.save();
        this.ctx.translate(px + TILE_SIZE / 2, py + TILE_SIZE / 2);
        this.ctx.scale(scale, scale);
        this.ctx.translate(-(px + TILE_SIZE / 2), -(py + TILE_SIZE / 2));
        this.ctx.restore();
    }

    /**
     * Draw UI elements (score, lives, level) with Press Start 2P font
     */
    drawUI(scoreManager, levelManager) {
        // Score (left)
        this.drawText('1UP', 4, 10, {
            size: 6,
            color: COLORS.TEXT_RED,
            align: 'left',
        });
        this.drawText(`${scoreManager.score}`.padStart(2, '0'), 4, 20, {
            size: 8,
            color: COLORS.TEXT_WHITE,
            align: 'left',
        });

        // Lives
        if (this.spritesLoaded) {
            const sprite = this.sprites['player_digging_horizontal_1'];
            if (sprite && sprite.complete) {
                for (let i = 1; i < scoreManager.lives; i++) {
                    const x = TILE_SIZE * 1.75 + (i - 1) * TILE_SIZE;
                    const y = 0;
                    this.ctx.drawImage(sprite, x, y, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // Hi-score (center)
        this.drawText('HI-SCORE', CANVAS_WIDTH / 2, 10, {
            size: 6,
            color: COLORS.TEXT_RED,
            align: 'center',
        });
        this.drawText(
            `${scoreManager.highScore}`.padStart(2, '0'),
            CANVAS_WIDTH / 2,
            20,
            {
                size: 8,
                color: COLORS.TEXT_WHITE,
                align: 'center',
            }
        );

        this.drawText(
            `ROUND ${levelManager.currentLevel}`,
            CANVAS_WIDTH - 4,
            10,
            {
                size: 6,
                color: COLORS.TEXT_WHITE,
                align: 'right',
            }
        );

        if (this.spritesLoaded) {
            const sprite = this.sprites['flower_small'];
            if (sprite && sprite.complete) {
                for (let i = 1; i <= levelManager.currentLevel; i++) {
                    this.ctx.drawImage(
                        sprite,
                        CANVAS_WIDTH - TILE_SIZE * i,
                        TILE_SIZE,
                        TILE_SIZE,
                        TILE_SIZE
                    );
                }
            }
        }
    }

    /**
     * Draw text with Press Start 2P font
     */
    drawText(text, x, y, options = {}) {
        const size = options.size || 16;
        const color = options.color || COLORS.TEXT_WHITE;
        const align = options.align || 'left';

        this.ctx.font = `${size}px "Press Start 2P", "Courier New", monospace`;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = align;
        this.ctx.fillText(text, x, y);
    }

    /**
     * Render respawning state with "Player 1 Ready" overlay
     */
    renderRespawning() {
        // Note: Game.js should call this.render() first, then this overlay
        // Overlay "Player 1 Ready" message
        this.drawText('PLAYER 1', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 3, {
            size: 10,
            color: COLORS.TEXT_WHITE,
            align: 'center',
        });
        this.drawText(
            'READY!',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + TILE_SIZE + 15,
            {
                size: 10,
                color: COLORS.TEXT_WHITE,
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
