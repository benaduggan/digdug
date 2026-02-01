import {
    ENEMY_TYPES,
    HI_SCORE_KEY,
    PLAYER,
    SCORES,
    TILE_SIZE,
} from '../utils/constants.js';

export class ScoreManager {
    constructor() {
        this.score = 0;
        this.lives = PLAYER.START_LIVES;
        this.highScore = this.loadHighScore();

        // Extra life thresholds: 20,000, 50,000, 100,000, 150,000, ...
        this.nextExtraLifeThreshold = 20000;
    }

    /**
     * Reset score and lives for new game
     */
    reset() {
        this.score = 0;
        this.lives = PLAYER.START_LIVES;
        this.nextExtraLifeThreshold = 20000;
    }

    /**
     * Add points for digging a tile
     */
    addDigScore() {
        const points = SCORES.DIG_TILE;
        this.addScore(points);
        return points;
    }

    /**
     * Calculate depth quarter based on Y position
     * Sky is rows 0-1, dirt is rows 2-17 (16 rows total)
     * Quarters of dirt: 2-5 (Q0), 6-9 (Q1), 10-13 (Q2), 14-17 (Q3)
     */
    getDepthQuarter(pixelY) {
        const gridY = Math.floor(pixelY / TILE_SIZE);
        const dirtStartRow = 2; // Skip sky rows
        const dirtRows = 16; // 16 rows of dirt
        const quarterSize = dirtRows / 4; // 4 rows per quarter

        const relativeRow = Math.max(0, gridY - dirtStartRow);
        return Math.min(3, Math.floor(relativeRow / quarterSize));
    }

    /**
     * Add points for enemy kill by pumping
     * Points based on depth and whether Fygar was killed horizontally
     */
    addEnemyKill(enemyType, enemyY, isHorizontalKill = false) {
        const depthQuarter = this.getDepthQuarter(enemyY);
        let points;

        if (enemyType === ENEMY_TYPES.FYGAR && isHorizontalKill) {
            points = SCORES.PUMP_KILL.FYGAR_HORIZONTAL[depthQuarter];
        } else if (enemyType === ENEMY_TYPES.FYGAR) {
            points = SCORES.PUMP_KILL.FYGAR[depthQuarter];
        } else {
            points = SCORES.PUMP_KILL.POOKA[depthQuarter];
        }

        this.addScore(points);
        return points;
    }

    /**
     * Add points for rock kill based on number of enemies killed
     */
    addRockKill(enemyCount) {
        // Cap at index 8 for 8+ enemies
        const index = Math.min(enemyCount, 8);
        const points = SCORES.ROCK_KILL[index];
        this.addScore(points);
        return points;
    }

    /**
     * Add points for bonus item based on prize index
     */
    addBonusItem(bonusIndex) {
        // bonusIndex is 0-based, maps to prize_1 through prize_11
        const safeIndex = Math.min(bonusIndex, SCORES.BONUS_ITEMS.length - 1);
        const points = SCORES.BONUS_ITEMS[safeIndex];
        this.addScore(points);
        return points;
    }

    /**
     * Add points to score and check for extra life
     * Returns true if an extra life was awarded
     */
    addScore(points) {
        this.score += points;

        // Check if we crossed an extra life threshold
        return this.checkExtraLife();
    }

    /**
     * Check and award extra life at thresholds:
     * 20,000, 50,000, then every 50,000 (100,000, 150,000, ...)
     */
    checkExtraLife() {
        if (this.score >= this.nextExtraLifeThreshold) {
            this.gainLife();

            // Calculate next threshold
            if (this.nextExtraLifeThreshold === 20000) {
                this.nextExtraLifeThreshold = 50000;
            } else {
                this.nextExtraLifeThreshold += 50000;
            }

            return true;
        }
        return false;
    }

    /**
     * Lose a life
     */
    loseLife() {
        this.lives--;
    }

    /**
     * Gain a life
     */
    gainLife() {
        this.lives++;
    }

    /**
     * Load high score from localStorage
     */
    loadHighScore() {
        try {
            const saved = localStorage.getItem(HI_SCORE_KEY);
            return saved ? parseInt(saved, 10) : 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Save high score to localStorage
     */
    saveHighScore() {
        try {
            localStorage.setItem(HI_SCORE_KEY, this.highScore.toString());
        } catch (e) {
            // Ignore localStorage errors
        }
    }
}
