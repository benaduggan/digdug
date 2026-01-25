import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    GAME_STATES,
    COLORS,
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
        this.renderer.drawText(
            'DIG DUG',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 - 60,
            {
                size: 16,
                color: COLORS.TEXT_YELLOW,
                align: 'center',
            }
        );
        this.renderer.drawText(
            'PRESS SPACE',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + 10,
            {
                size: 8,
                color: COLORS.TEXT_WHITE,
                align: 'center',
            }
        );
        this.renderer.drawText(
            'TO START',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + 30,
            {
                size: 8,
                color: COLORS.TEXT_WHITE,
                align: 'center',
            }
        );
        this.renderer.drawText(
            'ARROWS MOVE',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + 60,
            {
                size: 6,
                color: COLORS.TEXT_WHITE,
                align: 'center',
            }
        );
        this.renderer.drawText(
            'SPACE PUMP',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + 75,
            {
                size: 6,
                color: COLORS.TEXT_WHITE,
                align: 'center',
            }
        );

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

        this.state = GAME_STATES.PLAYING;
        this.scoreManager.reset();
        this.lastTime = 0; // Reset time tracking
        this.startLevel(1);
        this.gameLoop(0);
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

        // Reset dropped rocks counter
        this.droppedRocksCount = 0;
    }

    /**
     * Main game loop
     */
    gameLoop(currentTime) {
        // Calculate delta time
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Update and render based on game state
        switch (this.state) {
            case GAME_STATES.PLAYING:
                this.update(deltaTime);
                this.render();
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
     * Update game state
     */
    update(deltaTime) {
        // Check for pause
        if (this.inputManager.isKeyPressed('Escape')) {
            this.pause();
            return;
        }

        // Update player
        if (this.player) {
            this.player.update(deltaTime, this.inputManager, this.grid);
        }

        // Update enemies
        this.enemies.forEach((enemy) => {
            enemy.update(deltaTime, this.player, this.grid);
        });

        // Update rocks (pass player so rocks can check for trigger)
        this.rocks.forEach((rock) => {
            rock.update(deltaTime, this.grid, this.player);
        });

        // Update bonus items
        this.bonusItems.forEach((item) => {
            item.update(deltaTime);
        });

        // Check collisions
        this.checkCollisions();

        // Check level complete
        if (this.enemies.length === 0) {
            this.levelComplete();
        }
    }

    /**
     * Check all collisions
     */
    checkCollisions() {
        // Player-enemy collisions
        this.enemies = this.enemies.filter((enemy) => {
            if (
                this.collisionSystem.checkPlayerEnemyCollision(
                    this.player,
                    enemy
                )
            ) {
                if (enemy.isInflating) {
                    // Enemy defeated
                    const points = this.scoreManager.addEnemyKill(
                        enemy.type,
                        enemy.distanceFromPlayer
                    );
                    this.config.onScoreChange(this.scoreManager.score);
                    return false; // Remove enemy
                } else {
                    // Player hit
                    this.playerHit();
                }
            }
            return true;
        });

        // Rock-entity collisions
        this.rocks.forEach((rock) => {
            if (rock.isFalling) {
                // Check rock-enemy
                this.enemies = this.enemies.filter((enemy) => {
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
                        return false;
                    }
                    return true;
                });

                // Check rock-player
                if (
                    this.collisionSystem.checkRockEntityCollision(
                        rock,
                        this.player
                    )
                ) {
                    this.playerHit();
                }
            }
        });

        // Remove destroyed/crumbled rocks
        this.rocks = this.rocks.filter((rock) => !rock.isDestroyed);

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
     * Check if bonus item should spawn
     */
    checkBonusSpawn() {
        // Spawn bonus after 2 rocks dropped
        if (this.droppedRocksCount === 2 && this.bonusItems.length === 0) {
            const bonusItem = this.levelManager.spawnBonusItem();
            if (bonusItem) {
                this.bonusItems.push(bonusItem);
            }
        }
    }

    /**
     * Handle player getting hit
     */
    playerHit() {
        this.scoreManager.loseLife();

        if (this.scoreManager.lives <= 0) {
            this.gameOver();
        } else {
            // Respawn player
            this.player = new Player(this.grid);
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
        if (this.state === GAME_STATES.PAUSED) {
            this.state = GAME_STATES.PLAYING;
        }
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
            this.renderer.drawBonusItem(item);
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
        this.renderer.drawUI(this.scoreManager);

        // Debug mode
        if (this.config.debug) {
            this.renderer.drawDebugInfo(this.player, this.enemies);
        }
    }

    /**
     * Render paused state
     */
    renderPaused() {
        this.render();
        this.renderer.drawText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, {
            size: 16,
            color: COLORS.TEXT_YELLOW,
            align: 'center',
        });
    }

    /**
     * Render level complete
     */
    renderLevelComplete() {
        this.render();
        this.renderer.drawText(
            'LEVEL',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 - 10,
            {
                size: 12,
                color: COLORS.TEXT_YELLOW,
                align: 'center',
            }
        );
        this.renderer.drawText(
            'COMPLETE',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 + 10,
            {
                size: 12,
                color: COLORS.TEXT_YELLOW,
                align: 'center',
            }
        );
    }

    /**
     * Render game over
     */
    renderGameOver() {
        this.renderer.clear();
        this.renderer.drawText(
            'GAME OVER',
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 - 40,
            {
                size: 12,
                color: COLORS.TEXT_YELLOW,
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
                color: COLORS.TEXT_YELLOW,
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
