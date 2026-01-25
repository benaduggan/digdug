import { Enemy } from './Enemy.js';
import { ENEMY, DIRECTIONS } from '../utils/constants.js';

export class Fygar extends Enemy {
  constructor(x, y, level = 1) {
    super(x, y, 'fygar', ENEMY.FYGAR.SPEED, level);
    this.ghostSpeed = ENEMY.FYGAR.GHOST_SPEED;

    // Fire breathing
    this.canBreatheFire = true;
    this.isBreathingFire = false;
    this.fireBreathTimer = 0;
    this.fireBreathCooldown = ENEMY.FYGAR.FIRE_COOLDOWN;
    this.lastFireBreathTime = 0;
  }

  /**
   * Update Fygar-specific behavior
   */
  update(deltaTime, player, grid) {
    super.update(deltaTime, player, grid);

    // Handle fire breathing
    if (this.canBreatheFire && player && !this.isInflating) {
      this.updateFireBreath(deltaTime, player);
    }
  }

  /**
   * Update fire breath behavior
   */
  updateFireBreath(deltaTime, player) {
    const now = Date.now();

    // Check if can breathe fire again
    if (now - this.lastFireBreathTime > this.fireBreathCooldown) {
      // Check if player is in front and close enough
      const inRange = this.isPlayerInFireRange(player);

      if (inRange && Math.random() < 0.01) { // 1% chance per frame
        this.breatheFire();
      }
    }

    // Update fire breath duration
    if (this.isBreathingFire) {
      this.fireBreathTimer += deltaTime;

      if (this.fireBreathTimer > 800) { // 800ms fire breath duration
        this.stopBreathingFire();
      }
    }
  }

  /**
   * Check if player is in fire range
   */
  isPlayerInFireRange(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;

    // Check if player is horizontally aligned
    if (Math.abs(dy) < 16) { // Within same row
      // Check if player is in front based on direction
      if (this.direction === DIRECTIONS.RIGHT && dx > 0 && dx < ENEMY.FYGAR.FIRE_RANGE) {
        return true;
      }
      if (this.direction === DIRECTIONS.LEFT && dx < 0 && dx > -ENEMY.FYGAR.FIRE_RANGE) {
        return true;
      }
    }

    return false;
  }

  /**
   * Start breathing fire
   */
  breatheFire() {
    this.isBreathingFire = true;
    this.fireBreathTimer = 0;
    this.lastFireBreathTime = Date.now();
    this.isMoving = false; // Stop moving while breathing fire
  }

  /**
   * Stop breathing fire
   */
  stopBreathingFire() {
    this.isBreathingFire = false;
    this.fireBreathTimer = 0;
    this.isMoving = true;
  }
}
