import { Enemy } from './Enemy.js';
import { ENEMY, ENEMY_TYPES } from '../utils/constants.js';

export class Pooka extends Enemy {
    constructor(x, y, level = 1) {
        super(x, y, ENEMY_TYPES.POOKA, ENEMY.POOKA.SPEED, level);
        this.ghostSpeed = ENEMY.POOKA.GHOST_SPEED;
    }

    // Pooka uses base Enemy movement with ghost mode from timer
    // No override needed - ghost mode is handled by Enemy.updateGhostMode()
}
