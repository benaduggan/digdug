import { PLAYER, SCORES } from '../utils/constants.js';

export class ScoreManager {
    constructor() {
        this.score = 0;
        this.lives = PLAYER.START_LIVES;
        this.level = 1;
        this.highScore = this.loadHighScore();
    }

    /**
     * Reset score and lives for new game
     */
    reset() {
        this.score = 0;
        this.lives = PLAYER.START_LIVES;
        this.level = 1;
    }

    /**
     * Add points for enemy kill
     */
    addEnemyKill(enemyType, distance = 0) {
        let points =
            enemyType === 'pooka' ? SCORES.POOKA_BASE : SCORES.FYGAR_BASE;

        // Distance bonus (further away = more points)
        const distanceBonus =
            Math.floor(distance / 16) * SCORES.DISTANCE_MULTIPLIER;
        points += distanceBonus;

        this.addScore(points);
        return points;
    }

    /**
     * Add points for rock kill
     */
    addRockKill(enemyType) {
        const points = SCORES.ROCK_KILL;
        this.addScore(points);
        return points;
    }

    /**
     * Add points for bonus item
     */
    addBonusItem() {
        const points = SCORES.BONUS_ITEM;
        this.addScore(points);
        return points;
    }

    /**
     * Add points to score
     */
    addScore(points) {
        this.score += points;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }
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
     * Advance to next level
     */
    nextLevel() {
        this.level++;
    }

    /**
     * Load high score from localStorage
     */
    loadHighScore() {
        try {
            const saved = localStorage.getItem('digdug_highscore');
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
            localStorage.setItem('digdug_highscore', this.highScore.toString());
        } catch (e) {
            // Ignore localStorage errors
        }
    }
}
