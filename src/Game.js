import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    GAME_STATES,
    COLORS,
    DEATH,
    TILE_SIZE,
    ENEMY_TYPES,
    DIRECTIONS,
} from './utils/constants.js';
import { Renderer } from './Renderer.js';
import { Grid } from './utils/Grid.js';
import { InputManager } from './systems/InputManager.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { LevelManager } from './systems/LevelManager.js';
import { ScoreManager } from './systems/ScoreManager.js';
import { Player } from './entities/Player.js';

export class Game {
    constructor(config = {}) {
        this.config = {
            container: config.container || document.body,
            width: config.width || CANVAS_WIDTH,
            height: config.height || CANVAS_HEIGHT,
            scale: config.scale || 1,
            debug: config.debug || false,
            onGameOver: config.onGameOver || (() => {}),
            onLevelComplete: config.onLevelComplete || (() => {}),
            onScoreChange: config.onScoreChange || (() => {}),
        };

        this.state = GAME_STATES.MENU;
        this.lastTime = 0;
        this.animationFrameId = null;

        // Initialize systems
        this.renderer = new Renderer(this.config);
        this.grid = new Grid();
        this.inputManager = new InputManager();
        this.collisionSystem = new CollisionSystem(this.grid);
        this.levelManager = new LevelManager(this.grid);
        this.scoreManager = new ScoreManager();

        // Game entities
        this.player = null;
        this.enemies = [];
        this.rocks = [];
        this.bonusItems = [];

        // Rock respawn timer
        this.rockRespawnTimer = 0;
        this.ROCK_RESPAWN_DELAY = 5000; // 5 seconds before spawning a new rock
        this.needsRockRespawn = false;

        // Bonus spawn tracking
        this.bonusSpawnCount = 0; // Sequential counter for prize order

        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
    }

    /**
     * Initialize the game
     */
    init() {
        // Attach canvas to container
        this.renderer.attachTo(this.config.container);

        // Set up input listeners
        this.inputManager.init();

        // Show menu
        this.showMenu();
    }

    /**
     * Show the main menu
     */
    showMenu() {
        this.state = GAME_STATES.MENU;
        this.renderer.clear();
        this.renderer.drawMenu();

        // Wait for space key (only set up listener once)
        if (!this.menuListenerAdded) {
            this.menuListenerAdded = true;
            const startGame = (e) => {
                if (e.code === 'Space' && this.state === GAME_STATES.MENU) {
                    document.removeEventListener('keydown', startGame);
                    this.menuListenerAdded = false;
                    this.startGame();
                }
            };
            document.addEventListener('keydown', startGame);
        }
    }

    /**
     * Start a new game
     */
    startGame() {
        // Stop any existing game loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this.scoreManager.reset();
        this.lastTime = 0; // Reset time tracking

        // Start the intro animation instead of jumping straight to playing
        this.startIntro();

        this.gameLoop(0);
    }

    /**
     * Start the intro animation sequence
     */
    startIntro() {
        this.state = GAME_STATES.INTRO;

        // Generate the actual level first (creates tunnels, but we'll add player's tunnel too)
        this.levelManager.generateLevel(1);

        // Create enemies (spawned in tunnels, but frozen during intro)
        this.enemies = this.config.debug
            ? []
            : this.levelManager.spawnEnemies(1);

        // Create rocks AFTER enemies
        this.levelManager.placeRocksAfterEnemies(1, this.enemies);
        this.rocks = this.levelManager.getRocks();

        // Clear bonus items
        this.bonusItems = [];

        // Reset dropped rocks counter and bonus spawn count
        this.droppedRocksCount = 0;
        this.bonusSpawnCount = 0;

        // Reset rock respawn timer
        this.rockRespawnTimer = 0;
        this.needsRockRespawn = false;

        // Calculate target positions for player
        this.introCenterX = Math.floor(this.grid.width / 2); // Center column
        this.introCenterY = Math.floor(this.grid.height / 2); // Center row
        this.introTargetX = this.introCenterX * TILE_SIZE; // Pixel position for center
        this.introTargetY = this.introCenterY * TILE_SIZE;

        // Create player at the right edge of row 1 (in the sky)
        this.player = new Player(this.grid);
        this.player.x = this.grid.width * TILE_SIZE; // Start off-screen right
        this.player.y = TILE_SIZE; // Row 1 (second row, in the sky)
        this.player.direction = DIRECTIONS.LEFT;
        this.player.spriteFlipH = false;
        this.player.isMoving = true;

        // Intro animation state
        this.introPhase = 'walk_left'; // 'walk_left', 'dig_down', 'dig_tunnel', 'ready', 'done'
        this.introTimer = 0;
        this.introReadyDelay = 1000; // 1 second delay after reaching position
    }

    /**
     * Reset all game timers - called when game starts
     */
    resetAllTimers() {
        // Reset enemy timers
        this.enemies.forEach((enemy) => {
            enemy.resetTimers();
        });

        // Reset player timers
        if (this.player) {
            this.player.resetTimers();
        }
    }

    /**
     * Start a new level
     */
    startLevel(levelNumber) {
        // Generate level (creates tunnels)
        this.levelManager.generateLevel(levelNumber);

        // Create player
        this.player = new Player(this.grid);

        // Create enemies (must spawn in tunnels)
        this.enemies = this.levelManager.spawnEnemies(levelNumber);

        // Create rocks AFTER enemies (so rocks avoid enemy positions)
        this.levelManager.placeRocksAfterEnemies(levelNumber, this.enemies);
        this.rocks = this.levelManager.getRocks();

        // Clear bonus items
        this.bonusItems = [];

        // Reset dropped rocks counter (but NOT bonusSpawnCount - that persists across levels)
        this.droppedRocksCount = 0;

        // Reset rock respawn timer
        this.rockRespawnTimer = 0;
        this.needsRockRespawn = false;
    }

    /**
     * Main game loop
     */
    gameLoop(currentTime) {
        // Calculate delta time (cap at 100ms to prevent huge jumps on first frame or tab switch)
        const rawDelta = currentTime - this.lastTime;
        const deltaTime = Math.min(rawDelta, 100);
        this.lastTime = currentTime;

        // Update and render based on game state
        switch (this.state) {
            case GAME_STATES.INTRO:
                this.updateIntro(deltaTime);
                this.renderIntro();
                break;
            case GAME_STATES.PLAYING:
                this.update(deltaTime);
                this.render();
                break;
            case GAME_STATES.DYING:
                this.updateDeath(deltaTime);
                this.render(); // Render death animation
                break;
            case GAME_STATES.RESPAWNING:
                this.updateRespawn(deltaTime);
                this.renderRespawning();
                break;
            case GAME_STATES.PAUSED:
                this.renderPaused();
                break;
            case GAME_STATES.LEVEL_COMPLETE:
                this.renderLevelComplete();
                break;
            case GAME_STATES.GAME_OVER:
                this.renderGameOver();
                break;
        }

        // Continue loop
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }

    /**
     * Update intro animation
     */
    updateIntro(deltaTime) {
        const speed = this.config.debug ? 3 : 1.6; // Player movement speed during intro

        if (this.introPhase !== 'ready') {
            // Update player animation
            this.player.animationTimer += deltaTime;
            if (this.player.animationTimer > 100) {
                this.player.animationFrame =
                    (this.player.animationFrame + 1) % 2;
                this.player.animationTimer = 0;
            }
        }

        switch (this.introPhase) {
            case 'walk_left':
                // Walk left across the sky to center column
                this.player.x -= speed;
                this.player.isMoving = true;
                this.player.direction = DIRECTIONS.LEFT;
                this.player.spriteFlipH = false;

                if (this.player.x <= this.introTargetX) {
                    this.player.x = this.introTargetX;
                    this.introPhase = 'dig_down';
                    this.player.direction = DIRECTIONS.DOWN;
                    this.player.spriteFlipH = false;
                    this.player.spriteFlipV = false;
                }
                break;

            case 'dig_down': {
                // Dig straight down to center row
                this.player.y += speed;
                this.player.isMoving = true;
                this.player.isDigging = true;
                this.player.direction = DIRECTIONS.DOWN;

                // Dig the tile we're moving through
                const currentTile = this.grid.pixelToGrid(
                    this.player.x + TILE_SIZE / 2,
                    this.player.y + TILE_SIZE / 2
                );
                this.grid.dig(currentTile.x, currentTile.y);

                if (this.player.y >= this.introTargetY) {
                    this.player.y = this.introTargetY;
                    // Stop in center and go directly to ready phase
                    this.introPhase = 'ready';
                    this.introTimer = 0;
                    this.player.isMoving = false;
                    this.player.isDigging = false;
                    this.player.direction = DIRECTIONS.RIGHT;
                    this.player.spriteFlipH = true;
                }
                break;
            }

            case 'ready':
                this.player.animationFrame = 0;
                this.introTimer += deltaTime;
                if (this.introTimer >= this.introReadyDelay) {
                    this.introPhase = 'done';
                    this.finishIntro();
                }
                break;
        }
    }

    /**
     * Finish intro and start actual gameplay
     */
    finishIntro() {
        // Level is already set up from startIntro - just reset timers and start

        // Reset player timers
        this.player.resetTimers();

        // Reset all timers (unfreezes enemies)
        this.resetAllTimers();

        // Start playing
        this.state = GAME_STATES.PLAYING;
    }

    /**
     * Render intro animation
     */
    renderIntro() {
        this.renderer.clear();

        // Draw grid (shows the tunnel being dug)
        this.renderer.drawGrid(this.grid);

        // Draw rocks (already placed)
        this.rocks.forEach((rock) => {
            this.renderer.drawRock(rock);
        });

        // Draw player
        if (this.player) {
            this.renderer.drawPlayer(this.player);
        }

        // Draw enemies (frozen but visible)
        this.enemies.forEach((enemy) => {
            this.renderer.drawEnemy(enemy);
        });

        // Draw UI
        this.renderer.drawUI(this.scoreManager, this.levelManager);

        // Always show "Player 1 Ready" during intro
        this.renderer.renderRespawning();
    }

    /**
     * Update game state
     */
    update(deltaTime) {
        if (this.inputManager.isKeyPressed('Escape')) {
            this.pause();
            return;
        }

        // Update player
        if (this.player) {
            this.player.update(deltaTime, this.inputManager, this.grid);
        }

        // Mark last enemy
        if (this.enemies.length === 1) {
            this.enemies[0].isLastEnemy = true;
        }

        // Update enemies
        this.enemies.forEach((enemy) => {
            enemy.update(deltaTime, this.player, this.grid);
        });

        // Update rocks (pass player so rocks can check for trigger)
        this.rocks.forEach((rock) => {
            rock.update(deltaTime, this.grid, this.player);
        });

        // Update rock respawn timer if no rocks remain
        if (this.needsRockRespawn && this.rocks.length === 0) {
            this.rockRespawnTimer += deltaTime;
            if (this.rockRespawnTimer >= this.ROCK_RESPAWN_DELAY) {
                // Try to spawn a new rock in dirt
                const newRock = this.levelManager.spawnSingleRock();
                if (newRock) {
                    // Start spawn animation for fade-in/flash effect
                    newRock.startSpawnAnimation();
                    // Add rock to Game's rocks array
                    this.rocks.push(newRock);
                    this.needsRockRespawn = false;
                    this.rockRespawnTimer = 0;
                } else {
                    // No valid dirt position found, stop trying
                    this.needsRockRespawn = false;
                }
            }
        }

        // Update bonus items
        this.bonusItems.forEach((item) => {
            item.update(deltaTime);
        });

        // Check collisions
        this.checkCollisions();

        // Check level complete
        if (!this.config.debug && this.enemies.length === 0) {
            this.levelComplete();
        }
    }

    /**
     * Check all collisions
     */
    checkCollisions() {
        // Pump-enemy collisions (check if pump line hits any enemy)
        if (this.player.pumpLength > 0) {
            this.checkPumpCollisions();
        }

        // Fygar fire-player collisions
        this.checkFireCollisions();

        // Player-enemy collisions
        this.enemies.forEach((enemy) => {
            if (
                enemy.deflateTimer === 0 &&
                this.collisionSystem.checkPlayerEnemyCollision(
                    this.player,
                    enemy
                )
            ) {
                // Player hit by enemy
                this.playerHit('enemy');
            }
        });

        // Rock-entity collisions
        this.rocks.forEach((rock) => {
            if (rock.isFalling) {
                // Check rock-enemy
                this.enemies.forEach((enemy) => {
                    // Skip already smooshed enemies
                    if (enemy.isSmooshed) return;

                    if (
                        this.collisionSystem.checkRockEntityCollision(
                            rock,
                            enemy
                        )
                    ) {
                        rock.markEnemyCrushed(); // Mark rock as having crushed an enemy
                        this.scoreManager.addRockKill(enemy.type);
                        this.config.onScoreChange(this.scoreManager.score);
                        this.droppedRocksCount++;
                        this.checkBonusSpawn();

                        // Smoosh the enemy and attach to rock
                        enemy.smoosh();
                        enemy.attachedToRock = rock;
                        // Immediately sync position so enemy doesn't lag behind
                        enemy.x = rock.x;
                        enemy.y = rock.y;
                    }
                });

                // Check rock-player (skip if already smooshed)
                if (
                    !this.player.isSmooshed &&
                    this.collisionSystem.checkRockEntityCollision(
                        rock,
                        this.player
                    )
                ) {
                    // Smoosh player and attach to rock
                    this.player.smoosh(rock);
                    // Immediately sync position so player doesn't lag behind
                    this.player.x = rock.x;
                    this.player.y = rock.y;
                    this.state = GAME_STATES.DYING;
                    this.deathStartTime = Date.now();
                }
            }

            // Update smooshed enemies attached to this rock - they fall with it
            this.enemies.forEach((enemy) => {
                if (enemy.isSmooshed && enemy.attachedToRock === rock) {
                    enemy.x = rock.x;
                    enemy.y = rock.y;
                }
            });

            // Update smooshed player attached to this rock - falls with it
            if (this.player.isSmooshed && this.player.attachedToRock === rock) {
                this.player.x = rock.x;
                this.player.y = rock.y;
            }
        });

        // Remove destroyed/crumbled rocks
        const rocksBeforeFilter = this.rocks.length;
        this.rocks = this.rocks.filter((rock) => !rock.isDestroyed);

        // Check if all rocks are gone and start respawn timer
        if (this.rocks.length === 0 && rocksBeforeFilter > 0) {
            this.needsRockRespawn = true;
            this.rockRespawnTimer = 0;
        }

        // Remove escaped enemies
        this.enemies = this.enemies.filter((enemy) => !enemy.hasEscaped);

        // Remove destroyed enemies (popped from inflation or smooshed by rock)
        this.enemies = this.enemies.filter((enemy) => {
            if (enemy.isDestroyed) {
                // Only award points for pumped enemies (not smooshed - those were scored when rock hit)
                if (!enemy.isSmooshed) {
                    this.scoreManager.addEnemyKill(
                        enemy.type,
                        enemy.distanceFromPlayer
                    );
                    this.config.onScoreChange(this.scoreManager.score);
                }
                return false;
            }
            return true;
        });

        // Player-bonus item collisions
        this.bonusItems = this.bonusItems.filter((item) => {
            if (
                this.collisionSystem.checkPlayerBonusCollision(
                    this.player,
                    item
                )
            ) {
                const points = this.scoreManager.addBonusItem();
                this.config.onScoreChange(this.scoreManager.score);
                return false;
            }
            return true;
        });
    }

    /**
     * Check if pump line hits any enemies (only the closest one)
     */
    checkPumpCollisions() {
        // If already inflating an enemy, only continue inflating that one
        if (this.player.pumpTarget && !this.player.pumpTarget.isDestroyed) {
            this.player.pumpTarget.startInflation();
            return;
        }

        const playerCenter = this.player.getCenter();
        const pumpEnd = this.player.getPumpEndPoint();
        const pumpLength = this.player.pumpLength;

        // Find the closest enemy that the pump line intersects
        let closestEnemy = null;
        let closestDistance = Infinity;

        this.enemies.forEach((enemy) => {
            if (enemy.isDestroyed) return;

            // Check if pump line intersects with enemy
            const enemyCenter = enemy.getCenter();

            // Calculate distance from enemy center to pump line
            const distToLine = this.pointToLineDistance(
                enemyCenter.x,
                enemyCenter.y,
                playerCenter.x,
                playerCenter.y,
                pumpEnd.x,
                pumpEnd.y
            );

            // Distance from player to enemy
            const distToPlayer = Math.sqrt(
                Math.pow(enemyCenter.x - playerCenter.x, 2) +
                    Math.pow(enemyCenter.y - playerCenter.y, 2)
            );

            // Hit if close to line and within pump range
            const hitRadius = TILE_SIZE * 0.6; // Slightly forgiving hit box
            if (
                distToLine < hitRadius &&
                distToPlayer <= pumpLength + TILE_SIZE / 2
            ) {
                // Check enemy is in front of player (in pump direction)
                if (
                    this.isInPumpDirection(playerCenter, pumpEnd, enemyCenter)
                ) {
                    // Track the closest enemy
                    if (distToPlayer < closestDistance) {
                        closestDistance = distToPlayer;
                        closestEnemy = enemy;
                    }
                }
            }
        });

        // Only inflate the closest enemy (and lock onto them)
        if (closestEnemy) {
            closestEnemy.startInflation();
            this.player.pumpTarget = closestEnemy;
        }
    }

    /**
     * Calculate perpendicular distance from point to line segment
     */
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            // Line is a point
            return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        }

        // Project point onto line, clamped to segment
        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));

        const nearestX = x1 + t * dx;
        const nearestY = y1 + t * dy;

        return Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);
    }

    /**
     * Check if enemy is in the direction the pump is pointing
     */
    isInPumpDirection(playerCenter, pumpEnd, enemyCenter) {
        const pumpDx = pumpEnd.x - playerCenter.x;
        const pumpDy = pumpEnd.y - playerCenter.y;
        const enemyDx = enemyCenter.x - playerCenter.x;
        const enemyDy = enemyCenter.y - playerCenter.y;

        // Dot product should be positive if enemy is in pump direction
        return pumpDx * enemyDx + pumpDy * enemyDy > 0;
    }

    /**
     * Check if Fygar fire hits the player
     */
    checkFireCollisions() {
        this.enemies.forEach((enemy) => {
            // Only Fygars can breathe fire
            if (enemy.type === ENEMY_TYPES.POOKA || !enemy.isFireActive()) {
                return;
            }

            const fireHitbox = enemy.getFireHitbox();
            if (!fireHitbox) return;

            // Check AABB collision between fire and player
            const playerHit = this.collisionSystem.checkAABB(
                fireHitbox.x,
                fireHitbox.y,
                fireHitbox.width,
                fireHitbox.height,
                this.player.x,
                this.player.y,
                TILE_SIZE,
                TILE_SIZE
            );

            if (playerHit) {
                this.playerHit('enemy');
            }
        });
    }

    /**
     * Check if bonus item should spawn
     */
    checkBonusSpawn() {
        // Spawn bonus after 2 rocks dropped
        if (this.droppedRocksCount === 2 && this.bonusItems.length === 0) {
            const bonusItem = this.levelManager.spawnBonusItem(
                this.bonusSpawnCount
            );
            if (bonusItem) {
                this.bonusItems.push(bonusItem);
                this.bonusSpawnCount++; // Increment for next spawn to get next prize in sequence
            }
        }
    }

    /**
     * Handle player getting hit
     */
    playerHit(deathType = 'enemy') {
        if (this.player.isInvincible) return; // Skip if invincible

        // Start death animation
        this.player.startDeath(deathType);
        this.state = GAME_STATES.DYING;
        this.deathStartTime = Date.now();
    }

    /**
     * Update death animation state
     */
    updateDeath(deltaTime) {
        this.player.update(deltaTime, null, this.grid);

        // If player is smooshed, continue updating rocks so the attached rock can finish falling
        if (this.player.isSmooshed) {
            this.rocks.forEach((rock) => {
                rock.update(deltaTime, this.grid, null); // Pass null for player to skip trigger checks
            });

            // Sync player position with attached rock
            if (this.player.attachedToRock) {
                this.player.x = this.player.attachedToRock.x;
                this.player.y = this.player.attachedToRock.y;
            }
        }

        if (this.player.deathTimer >= DEATH.ANIMATION_DURATION) {
            // Death animation complete
            this.scoreManager.loseLife();

            if (this.scoreManager.lives <= 0) {
                this.gameOver();
            } else {
                this.startRespawn();
            }
        }
    }

    /**
     * Start respawn sequence
     */
    startRespawn() {
        this.state = GAME_STATES.RESPAWNING;
        this.respawnStartTime = Date.now();

        // Reset player position
        this.player = new Player(this.grid);
        this.player.isInvincible = true;

        // Reset enemy positions to their spawn tunnels
        this.enemies.forEach((enemy, index) => {
            const spawnPos = this.levelManager.getEnemySpawnPosition(index);
            enemy.x = spawnPos.x;
            enemy.y = spawnPos.y;

            // Reset all timers and state (includes Fygar fire state)
            enemy.resetTimers();

            // Reset additional state not covered by resetTimers
            enemy.inTunnel = true;
            enemy.state = 'roaming';
            enemy.isLastEnemy = false;
            enemy.isEscaping = false;
            enemy.hasEscaped = false;
        });

        // Reset rock states (cancel any pending falls triggered by player)
        this.rocks.forEach((rock) => {
            rock.reset();
        });
    }

    /**
     * Update respawn state
     */
    updateRespawn(deltaTime) {
        const elapsed = Date.now() - this.respawnStartTime;

        if (elapsed >= DEATH.RESPAWN_DELAY) {
            this.state = GAME_STATES.PLAYING;
            // Reset all timers when gameplay resumes
            this.resetAllTimers();
        }
    }

    /**
     * Level complete
     */
    levelComplete() {
        this.state = GAME_STATES.LEVEL_COMPLETE;
        const nextLevel = this.levelManager.currentLevel + 1;
        this.config.onLevelComplete(nextLevel - 1);

        // Wait 2 seconds then start next level
        setTimeout(() => {
            this.startLevel(nextLevel);
            this.state = GAME_STATES.PLAYING;
        }, 2000);
    }

    /**
     * Game over
     */
    gameOver() {
        this.state = GAME_STATES.GAME_OVER;
        this.config.onGameOver(this.scoreManager.score);
        if (this.scoreManager.score > this.scoreManager.highScore) {
            this.scoreManager.highScore = this.scoreManager.score;
            this.scoreManager.saveHighScore();
        }
    }

    /**
     * Pause the game
     */
    pause() {
        this.state = GAME_STATES.PAUSED;
    }

    /**
     * Resume the game
     */
    resume() {
        this.state = GAME_STATES.PLAYING;
    }

    /**
     * Render the game
     */
    render() {
        this.renderer.clear();

        // Draw grid (dirt/tunnels)
        this.renderer.drawGrid(this.grid);

        // Draw rocks
        this.rocks.forEach((rock) => {
            this.renderer.drawRock(rock);
        });

        // Draw bonus items
        this.bonusItems.forEach((item) => {
            this.renderer.drawBonusItem(item, this.levelManager.currentLevel);
        });

        // Draw player
        if (this.player) {
            this.renderer.drawPlayer(this.player);
        }

        // Draw enemies
        this.enemies.forEach((enemy) => {
            this.renderer.drawEnemy(enemy);
        });

        // Draw UI
        this.renderer.drawUI(this.scoreManager, this.levelManager);

        // Debug mode
        if (this.config.debug) {
            this.renderer.drawDebugInfo(this.player, this.enemies);
        }
    }

    /**
     * Render paused state
     */
    renderPaused() {
        if (this.inputManager.isKeyPressed('Escape')) {
            this.resume();
            return;
        }

        this.render();
        this.renderer.drawText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, {
            size: 16,
            color: COLORS.TEXT_WHITE,
            align: 'center',
        });
    }

    /**
     * Render respawning state
     */
    renderRespawning() {
        this.render();
        this.renderer.renderRespawning();
    }

    /**
     * Render level complete
     */
    renderLevelComplete() {
        this.render();
        this.renderer.drawText(
            `LEVEL ${this.levelManager.currentLevel} `,
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 - 10,
            {
                size: 12,
                color: COLORS.TEXT_WHITE,
                align: 'center',
            }
        );
        this.renderer.drawText(
            'COMPLETE',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + 10,
            {
                size: 12,
                color: COLORS.TEXT_WHITE,
                align: 'center',
            }
        );
    }

    /**
     * Render game over
     */
    renderGameOver() {
        this.renderer.forceClear();
        this.renderer.drawText(
            'GAME OVER',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 - 40,
            {
                size: 12,
                color: COLORS.TEXT_RED,
                align: 'center',
            }
        );
        this.renderer.drawText('SCORE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, {
            size: 8,
            color: COLORS.TEXT_WHITE,
            align: 'center',
        });
        this.renderer.drawText(
            `${this.scoreManager.score}`,
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + 20,
            {
                size: 10,
                color: COLORS.TEXT_RED,
                align: 'center',
            }
        );
        this.renderer.drawText(
            'PRESS SPACE',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + 50,
            {
                size: 6,
                color: COLORS.TEXT_WHITE,
                align: 'center',
            }
        );
        this.renderer.drawText(
            'TO RESTART',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + 65,
            {
                size: 6,
                color: COLORS.TEXT_WHITE,
                align: 'center',
            }
        );

        // Check if space is pressed to restart (only set up listener once)
        if (!this.restartListenerAdded) {
            this.restartListenerAdded = true;
            const restart = (e) => {
                if (
                    e.code === 'Space' &&
                    this.state === GAME_STATES.GAME_OVER
                ) {
                    document.removeEventListener('keydown', restart);
                    this.restartListenerAdded = false;
                    this.startGame();
                }
            };
            document.addEventListener('keydown', restart);
        }
    }

    /**
     * Start the game
     */
    start() {
        this.init();
    }

    /**
     * Stop the game
     */
    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.inputManager.destroy();
    }
}
