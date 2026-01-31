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
            'hose_horizontal_1.png',
            'hose_horizontal_2.png',
            'hose_vertical_1.png',
            'hose_vertical_2.png',
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
                    // Draw dirt with depth-based coloring (adjusted for sky rows)
                    const depthRatio = (y - 2) / (grid.height - 2);
                    const color = this.getDirtColor(depthRatio);
                    ctx.fillStyle = color;
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

                    // Add deterministic texture pattern
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                    if ((x + y) % 2 === 0) {
                        ctx.fillRect(px + 2, py + 2, 2, 2);
                        ctx.fillRect(px + 8, py + 10, 2, 2);
                    } else {
                        ctx.fillRect(px + 6, py + 4, 2, 2);
                        ctx.fillRect(px + 12, py + 8, 2, 2);
                    }

                    // Add lighter highlights
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    if ((x + y) % 3 === 0) {
                        ctx.fillRect(px + 1, py + 1, 1, 1);
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

        const px = player.x;
        const py = player.y;

        // Use sprites if loaded, otherwise fallback to simple square
        if (this.spritesLoaded) {
            // Determine which sprite set to use (horizontal or vertical, walking or digging)
            let spriteAction = 'walking';
            if (player.isDigging) spriteAction = 'digging';
            else if (player.isPumping) spriteAction = 'pumping';

            let frameNumber = player.animationFrame === 0 ? '_1' : '_2';
            const orientation =
                player.direction === DIRECTIONS.LEFT ||
                player.direction === DIRECTIONS.RIGHT
                    ? 'horizontal'
                    : 'vertical';

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
                    this.ctx.save();
                    const centerX = px + TILE_SIZE / 2;
                    const centerY = py + TILE_SIZE / 2;
                    this.ctx.translate(centerX, centerY);
                    this.ctx.scale(
                        player.spriteFlipH ? -1 : 1,
                        player.spriteFlipV ? -1 : 1
                    );
                    this.ctx.drawImage(
                        sprite,
                        -TILE_SIZE / 2,
                        -TILE_SIZE / 2,
                        TILE_SIZE,
                        TILE_SIZE
                    );
                    this.ctx.restore();
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

        // Draw pump line if pumping
        if (player.pumpLength > 0) {
            this.drawPumpLine(player);
        }
    }

    /**
     * Draw player death animation
     */
    drawPlayerDeath(player) {
        const progress = player.deathTimer / DEATH.ANIMATION_DURATION;
        const px = player.x;
        const py = player.y;

        // Death type determines animation
        if (player.deathType === 'rock') {
            // Squish effect - vertical compression
            this.ctx.save();
            this.ctx.globalAlpha = 1 - progress;
            this.ctx.fillStyle = '#3498db';
            const squishHeight = TILE_SIZE * (1 - progress * 0.8);
            this.ctx.fillRect(
                px + 2,
                py + TILE_SIZE - squishHeight,
                TILE_SIZE - 4,
                squishHeight
            );
            this.ctx.restore();
        } else {
            // Enemy hit - particle explosion
            this.ctx.save();
            this.ctx.globalAlpha = 1 - progress;
            this.ctx.fillStyle = '#3498db';
            const spread = progress * 8;
            // 4 particles spreading outward
            this.ctx.fillRect(px + 6 - spread, py + 6, 4, 4);
            this.ctx.fillRect(px + 6 + spread, py + 6, 4, 4);
            this.ctx.fillRect(px + 6, py + 6 - spread, 4, 4);
            this.ctx.fillRect(px + 6, py + 6 + spread, 4, 4);
            this.ctx.restore();
        }
    }

    /**
     * Draw pump line extending from player
     */
    drawPumpLine(player) {
        const startX = player.x + TILE_SIZE / 2;
        const startY = player.y + TILE_SIZE / 2;
        const endPoint = player.getPumpEndPoint();

        // Draw the pump line
        this.ctx.strokeStyle = COLORS.PLAYER_WHITE;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endPoint.x, endPoint.y);
        this.ctx.stroke();

        // Draw pump head (small circle at the end)
        this.ctx.fillStyle = COLORS.PLAYER_WHITE;
        this.ctx.beginPath();
        this.ctx.arc(endPoint.x, endPoint.y, 4, 0, Math.PI * 2);
        this.ctx.fill();
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
     * Draw a rock (simple gray square with crumble animation)
     */
    drawRock(rock) {
        const px = rock.x;
        const py = rock.y;

        // Crumble animation - needs alpha so use save/restore
        if (rock.isCrumbling) {
            const progress = rock.crumbleTimer / rock.CRUMBLE_DURATION;
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

        // Calculate shake offset (use rock's own timer instead of Date.now for consistency)
        const shakeOffset = rock.isShaking
            ? Math.sin(rock.shakeTimer / 50) * 2
            : 0;
        const drawX = px + shakeOffset;

        if (this.spritesLoaded) {
            const sprite = this.sprites['rock_1'];
            if (sprite && sprite.complete) {
                this.ctx.drawImage(sprite, drawX, py, TILE_SIZE, TILE_SIZE);
            } else {
                this.drawRockFallback(drawX, py);
            }
        } else {
            this.drawRockFallback(drawX, py);
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
