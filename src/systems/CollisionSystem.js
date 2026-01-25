import { TILE_SIZE } from '../utils/constants.js';

export class CollisionSystem {
  constructor(grid) {
    this.grid = grid;
  }

  /**
   * Check if two rectangles overlap (AABB collision)
   */
  checkAABB(x1, y1, w1, h1, x2, y2, w2, h2) {
    return (
      x1 < x2 + w2 &&
      x1 + w1 > x2 &&
      y1 < y2 + h2 &&
      y1 + h1 > y2
    );
  }

  /**
   * Check collision between player and enemy
   */
  checkPlayerEnemyCollision(player, enemy) {
    return this.checkAABB(
      player.x, player.y, TILE_SIZE, TILE_SIZE,
      enemy.x, enemy.y, TILE_SIZE, TILE_SIZE
    );
  }

  /**
   * Check collision between rock and entity
   */
  checkRockEntityCollision(rock, entity) {
    return this.checkAABB(
      rock.x, rock.y, TILE_SIZE, TILE_SIZE,
      entity.x, entity.y, TILE_SIZE, TILE_SIZE
    );
  }

  /**
   * Check collision between player and bonus item
   */
  checkPlayerBonusCollision(player, bonus) {
    return this.checkAABB(
      player.x, player.y, TILE_SIZE, TILE_SIZE,
      bonus.x, bonus.y, TILE_SIZE, TILE_SIZE
    );
  }

  /**
   * Check if pump is in range of enemy
   */
  checkPumpRange(player, enemy, range) {
    const dx = (player.x + TILE_SIZE / 2) - (enemy.x + TILE_SIZE / 2);
    const dy = (player.y + TILE_SIZE / 2) - (enemy.y + TILE_SIZE / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= range;
  }

  /**
   * Check if entity is facing direction towards target
   */
  isFacing(entity, target, direction) {
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;

    switch (direction) {
      case 'up':
        return dy < 0 && Math.abs(dy) > Math.abs(dx);
      case 'down':
        return dy > 0 && Math.abs(dy) > Math.abs(dx);
      case 'left':
        return dx < 0 && Math.abs(dx) > Math.abs(dy);
      case 'right':
        return dx > 0 && Math.abs(dx) > Math.abs(dy);
      default:
        return false;
    }
  }

  /**
   * Get distance between two points
   */
  getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check line of sight between two entities
   */
  hasLineOfSight(entity1, entity2) {
    const { x: gx1, y: gy1 } = this.grid.pixelToGrid(entity1.x, entity1.y);
    const { x: gx2, y: gy2 } = this.grid.pixelToGrid(entity2.x, entity2.y);

    // Use Bresenham's line algorithm to check tiles between entities
    const dx = Math.abs(gx2 - gx1);
    const dy = Math.abs(gy2 - gy1);
    const sx = gx1 < gx2 ? 1 : -1;
    const sy = gy1 < gy2 ? 1 : -1;
    let err = dx - dy;
    let x = gx1;
    let y = gy1;

    while (x !== gx2 || y !== gy2) {
      // If there's dirt in the way, no line of sight
      if (this.grid.isDirt(x, y)) {
        return false;
      }

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return true;
  }
}
