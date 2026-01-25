import { Enemy } from './Enemy.js';
import { ENEMY } from '../utils/constants.js';

export class Pooka extends Enemy {
    constructor(x, y, level = 1) {
        super(x, y, 'pooka', ENEMY.POOKA.SPEED, level);
        this.ghostSpeed = ENEMY.POOKA.GHOST_SPEED;
    }

    /**
     * Pookas are better at ghosting through dirt
     */
    move(grid, player = null) {
        const { x: gx, y: gy } = grid.pixelToGrid(this.x, this.y);
        const inDirt = grid.isDirt(gx, gy);

        // Pookas move at same speed through dirt and tunnels (good ghosters)
        this.isGhosting = inDirt;

        super.move(grid, player);
    }
}
