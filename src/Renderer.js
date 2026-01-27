import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    TILE_SIZE,
    COLORS,
    TILE_TYPES,
    DIRECTIONS,
    DEATH,
    ENEMY,
} from './utils/constants.js';

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

    /**
     * Clear the canvas
     */
    clear() {
        this.ctx.fillStyle = COLORS.BACKGROUND;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draw the grid (dirt tiles and tunnels) with better visuals
     */
    drawGrid(grid) {
        for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
                const tile = grid.getTile(x, y);
                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;

                if (tile === TILE_TYPES.DIRT) {
                    // Draw dirt with depth-based coloring
                    const depthRatio = y / grid.height;
                    const color = this.getDirtColor(depthRatio);
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

                    // Add deterministic texture pattern using position-based seed
                    const seed = x * 1000 + y;
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                    // Create a simple dirt texture pattern
                    if ((x + y) % 2 === 0) {
                        this.ctx.fillRect(px + 2, py + 2, 2, 2);
                        this.ctx.fillRect(px + 8, py + 10, 2, 2);
                    } else {
                        this.ctx.fillRect(px + 6, py + 4, 2, 2);
                        this.ctx.fillRect(px + 12, py + 8, 2, 2);
                    }

                    // Add lighter highlights
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    if ((x + y) % 3 === 0) {
                        this.ctx.fillRect(px + 1, py + 1, 1, 1);
                    }
                }
                // Empty tiles (tunnels) are just black background
            }
        }
    }

    /**
     * Get dirt color based on depth
     */
    getDirtColor(depthRatio) {
        if (depthRatio < 0.33) return COLORS.DIRT_LIGHT;
        if (depthRatio < 0.66) return COLORS.DIRT_MID;
        return COLORS.DIRT_DARK;
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
            let spriteBaseName = '';
            const spriteAction = player.isDigging ? 'digging' : 'walking';
            const frameNumber = player.animationFrame === 0 ? '1' : '2';

            // Select sprite based on direction
            if (
                player.direction === DIRECTIONS.LEFT ||
                player.direction === DIRECTIONS.RIGHT
            ) {
                // Use horizontal sprites
                spriteBaseName = `player_${spriteAction}_horizontal_${frameNumber}`;
            } else {
                // Use vertical sprites for UP and DOWN
                spriteBaseName = `player_${spriteAction}_vertical_${frameNumber}`;
            }

            const sprite = this.sprites[spriteBaseName];

            if (sprite && sprite.complete) {
                this.ctx.save();

                // Calculate center point for transformations
                const centerX = px + TILE_SIZE / 2;
                const centerY = py + TILE_SIZE / 2;

                // Move to center
                this.ctx.translate(centerX, centerY);

                // Apply flips based on player's sprite state
                if (player.spriteFlipH && player.spriteFlipV) {
                    this.ctx.scale(-1, -1);
                } else if (player.spriteFlipH) {
                    this.ctx.scale(-1, 1);
                } else if (player.spriteFlipV) {
                    this.ctx.scale(1, -1);
                }

                // Draw sprite centered at origin
                this.ctx.drawImage(
                    sprite,
                    -TILE_SIZE / 2,
                    -TILE_SIZE / 2,
                    TILE_SIZE,
                    TILE_SIZE
                );

                this.ctx.restore();
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
     * Draw an enemy (simple colored circles)
     */
    drawEnemy(enemy) {
        const px = enemy.x;
        const py = enemy.y;
        const inflateScale = enemy.isInflating ? enemy.inflateLevel : 1.0;
        const centerX = px + TILE_SIZE / 2;
        const centerY = py + TILE_SIZE / 2;

        this.ctx.save();
        this.ctx.translate(centerX, centerY);
        this.ctx.scale(inflateScale, inflateScale);
        this.ctx.translate(-centerX, -centerY);

        // Draw different colored circles for different enemy types
        if (enemy.type === 'pooka') {
            // Red circle for Pooka
            this.ctx.fillStyle = enemy.isGhosting
                ? 'rgba(231, 76, 60, 0.5)'
                : '#e74c3c';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (enemy.type === 'fygar') {
            // Green circle for Fygar
            this.ctx.fillStyle = enemy.isGhosting
                ? 'rgba(46, 204, 113, 0.5)'
                : '#2ecc71';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();

        // Draw flashing eyes if in ghost mode
        if (enemy.isGhosting) {
            this.drawGhostModeEyes(px, py, enemy.eyeFlashTimer);
        }

        // Draw fire breath for Fygar
        if (enemy.type === 'fygar') {
            if (enemy.isCharging && enemy.isCharging()) {
                this.drawFygarCharging(enemy);
            } else if (enemy.isFireActive && enemy.isFireActive()) {
                this.drawFygarFire(enemy);
            }
        }
    }

    /**
     * Draw flashing eyes for ghost mode
     */
    drawGhostModeEyes(x, y, flashTimer) {
        // Flash on/off every 200ms
        const isVisible = Math.floor(flashTimer / 200) % 2 === 0;

        if (isVisible) {
            // Draw two white eyes
            this.ctx.fillStyle = '#ffffff';
            // Left eye
            this.ctx.fillRect(x + 4, y + 6, 3, 3);
            // Right eye
            this.ctx.fillRect(x + 9, y + 6, 3, 3);

            // Eye pupils (black)
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(x + 5, y + 7, 1, 1);
            this.ctx.fillRect(x + 10, y + 7, 1, 1);
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
     * Draw Fygar fire breath
     */
    drawFygarFire(enemy) {
        const fireHitbox = enemy.getFireHitbox();
        if (!fireHitbox) return;

        const direction = enemy.getFireDirection();
        const centerY = enemy.y + TILE_SIZE / 2;

        // Draw fire as a series of flame segments extending from Fygar
        const fireLength = ENEMY.FYGAR.FIRE_RANGE;
        const segments = 6;
        const segmentWidth = fireLength / segments;

        for (let i = 0; i < segments; i++) {
            // Flame color gradient from yellow to red
            const colorProgress = i / segments;
            const red = 255;
            const green = Math.floor(200 - colorProgress * 150);
            const blue = Math.floor(50 - colorProgress * 50);
            this.ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;

            // Calculate segment position
            let segX;
            if (direction === DIRECTIONS.RIGHT) {
                segX = enemy.x + TILE_SIZE + i * segmentWidth;
            } else {
                segX = enemy.x - (i + 1) * segmentWidth;
            }

            // Flame height varies (taller in middle, smaller at edges)
            const baseHeight = TILE_SIZE * 0.6;
            const heightVariation =
                Math.sin((i / segments) * Math.PI) * TILE_SIZE * 0.3;
            const flameHeight = baseHeight + heightVariation;

            // Add flickering effect
            const flicker = Math.sin(Date.now() / 50 + i * 2) * 2;

            // Draw flame segment
            this.ctx.fillRect(
                segX,
                centerY - flameHeight / 2 + flicker,
                segmentWidth + 1, // +1 to avoid gaps
                flameHeight
            );
        }

        // Draw bright core of flame near Fygar
        this.ctx.fillStyle = '#ffff00'; // Bright yellow
        const coreX =
            direction === DIRECTIONS.RIGHT
                ? enemy.x + TILE_SIZE
                : enemy.x - TILE_SIZE / 2;
        this.ctx.fillRect(coreX, centerY - 4, TILE_SIZE / 2, 8);
    }

    /**
     * Draw a rock (simple gray square with crumble animation)
     */
    drawRock(rock) {
        const px = rock.x;
        const py = rock.y;

        this.ctx.save();

        // Crumble animation
        if (rock.isCrumbling) {
            const progress = rock.crumbleTimer / rock.CRUMBLE_DURATION;
            const alpha = 1 - progress; // Fade out

            this.ctx.globalAlpha = alpha;

            // Draw crumbling particles
            this.ctx.fillStyle = '#95a5a6'; // Gray
            const offset = progress * 4;
            // Main pieces breaking apart
            this.ctx.fillRect(px + 2 - offset, py + 3, 4, 4);
            this.ctx.fillRect(px + 10 + offset, py + 3, 4, 4);
            this.ctx.fillRect(px + 6, py + 8 + offset, 4, 4);

            this.ctx.restore();
            return;
        }

        // Shake effect if about to fall
        if (rock.isShaking) {
            const shake = Math.sin(Date.now() / 50) * 2;
            this.ctx.translate(shake, 0);
        }

        // Simple gray square for rock
        this.ctx.fillStyle = '#95a5a6'; // Gray
        this.ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

        this.ctx.restore();
    }

    /**
     * Draw bonus item
     */
    drawBonusItem(item) {
        const px = item.x;
        const py = item.y;

        // Draw simple bonus item (yellow circle/fruit)
        this.ctx.fillStyle = COLORS.TEXT_YELLOW;
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
    drawUI(scoreManager) {
        const padding = 8;
        const fontSize = 8; // Smaller for Press Start 2P font

        // Score (left)
        this.drawText(
            `${scoreManager.score}`,
            padding,
            padding + fontSize + 4,
            {
                size: fontSize,
                color: COLORS.TEXT_WHITE,
                align: 'left',
            }
        );
        this.drawText('SCORE', padding, padding + fontSize + 16, {
            size: 6,
            color: COLORS.TEXT_YELLOW,
            align: 'left',
        });

        // Lives (right)
        this.drawText(
            `${scoreManager.lives}`,
            CANVAS_WIDTH - padding,
            padding + fontSize + 4,
            {
                size: fontSize,
                color: COLORS.TEXT_WHITE,
                align: 'right',
            }
        );
        this.drawText(
            'LIVES',
            CANVAS_WIDTH - padding,
            padding + fontSize + 16,
            {
                size: 6,
                color: COLORS.TEXT_YELLOW,
                align: 'right',
            }
        );

        // Level (center)
        this.drawText(
            `LVL ${scoreManager.level}`,
            CANVAS_WIDTH / 2,
            padding + fontSize + 4,
            {
                size: fontSize,
                color: COLORS.TEXT_YELLOW,
                align: 'center',
            }
        );
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
        this.drawText('PLAYER 1', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10, {
            size: 10,
            color: COLORS.TEXT_YELLOW,
            align: 'center',
        });
        this.drawText('READY', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10, {
            size: 10,
            color: COLORS.TEXT_YELLOW,
            align: 'center',
        });
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
