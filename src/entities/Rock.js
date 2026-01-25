import { TILE_SIZE, ROCK } from '../utils/constants.js';

export class Rock {
  constructor(x, y, grid) {
    this.x = x;
    this.y = y;
    this.grid = grid;

    // State
    this.isFalling = false;
    this.isShaking = false;
    this.shakeTimer = 0;
    this.fallDelay = ROCK.FALL_DELAY;
    this.fallSpeed = ROCK.FALL_SPEED;

    // Crumbling state (when hits dirt without killing enemy)
    this.isCrumbling = false;
    this.crumbleTimer = 0;
    this.CRUMBLE_DURATION = 300; // ms to show crumble animation

    // Track if rock crushed any enemies
    this.crushedEnemy = false;

    // Track player position to wait for them to move
    this.playerStillBelow = false;
    this.playerLastX = 0;
    this.playerLastY = 0;

    // Grid position
    this.gridX = Math.floor(x / TILE_SIZE);
    this.gridY = Math.floor(y / TILE_SIZE);
  }

  /**
   * Update rock state
   */
  update(deltaTime, grid, player) {
    // Update crumbling animation
    if (this.isCrumbling) {
      this.crumbleTimer += deltaTime;
      if (this.crumbleTimer > this.CRUMBLE_DURATION) {
        this.isDestroyed = true; // Mark for removal
      }
      return; // Don't process anything else while crumbling
    }

    // Update shaking
    if (this.isShaking) {
      this.shakeTimer += deltaTime;

      // Check if player has moved away before allowing fall
      if (this.shakeTimer > ROCK.SHAKE_DURATION) {
        if (player && this.playerStillBelow) {
          // Check if player moved away
          const playerGridX = Math.floor(player.x / TILE_SIZE);
          const playerGridY = Math.floor(player.y / TILE_SIZE);
          const playerMoved = playerGridX !== Math.floor(this.playerLastX / TILE_SIZE) ||
                             playerGridY !== Math.floor(this.playerLastY / TILE_SIZE);

          if (playerMoved) {
            this.playerStillBelow = false;
            this.startFalling(grid);
          }
        } else {
          this.startFalling(grid);
        }
      }
    }

    // Update falling
    if (this.isFalling) {
      this.fall(grid);
    }

    // Check if player is touching rock from below to trigger fall
    if (!this.isFalling && !this.isShaking && player) {
      this.checkPlayerTrigger(player, grid);
    }
  }

  /**
   * Check if player is touching rock from below
   */
  checkPlayerTrigger(player, grid) {
    // Check if there's no dirt below the rock
    const hasDirtBelow = grid.isDirt(this.gridX, this.gridY + 1);
    const hasRockBelow = grid.isRock(this.gridX, this.gridY + 1);

    if (hasDirtBelow || hasRockBelow || this.gridY >= grid.height - 1) {
      return; // Rock is supported, can't fall
    }

    // Check if player is directly below the rock
    const playerGridX = Math.floor(player.x / TILE_SIZE);
    const playerGridY = Math.floor(player.y / TILE_SIZE);

    // Player must be in the tile directly below or diagonally adjacent below
    const isBelow = playerGridY === this.gridY + 1 &&
                    Math.abs(playerGridX - this.gridX) <= 1;

    // Also check if player's head is touching rock's bottom
    const playerTop = player.y;
    const rockBottom = this.y + TILE_SIZE;
    const verticalOverlap = Math.abs(playerTop - rockBottom) < 4;
    const horizontalOverlap = Math.abs(player.x - this.x) < TILE_SIZE;

    if ((isBelow && verticalOverlap && horizontalOverlap) ||
        (verticalOverlap && horizontalOverlap && player.y < this.y)) {
      // Player touched from below, trigger the rock
      this.playerStillBelow = true;
      this.playerLastX = player.x;
      this.playerLastY = player.y;
      this.startShaking();
    }
  }

  /**
   * Start shaking animation
   */
  startShaking() {
    this.isShaking = true;
    this.shakeTimer = 0;
  }

  /**
   * Start falling
   */
  startFalling(grid) {
    this.isFalling = true;
    this.isShaking = false;

    // Remove rock from grid
    grid.removeRock(this.gridX, this.gridY);
  }

  /**
   * Fall downward
   */
  fall(grid) {
    this.y += this.fallSpeed;

    // Update grid position
    const newGridY = Math.floor(this.y / TILE_SIZE);

    if (newGridY !== this.gridY) {
      this.gridY = newGridY;

      // Check what's below: dirt, rock, or bottom
      const hasDirtBelow = grid.isDirt(this.gridX, this.gridY + 1);
      const hasRockBelow = grid.isRock(this.gridX, this.gridY + 1);
      const hitBottom = this.gridY >= grid.height - 1;

      if (hasDirtBelow || hasRockBelow || hitBottom) {
        this.stopFalling(grid, hasDirtBelow);
      }
    }
  }

  /**
   * Stop falling - crumble if hit dirt without killing enemy
   */
  stopFalling(grid, hitDirt) {
    this.isFalling = false;

    // Snap to grid
    this.y = this.gridY * TILE_SIZE;

    // If hit dirt and didn't crush any enemies, crumble and disappear
    if (hitDirt && !this.crushedEnemy) {
      this.isCrumbling = true;
      this.crumbleTimer = 0;
      // Don't place rock back in grid - it will disappear
    } else {
      // Hit bottom or another rock, or crushed an enemy - stay in place
      grid.placeRock(this.gridX, this.gridY);
    }
  }

  /**
   * Mark that this rock crushed an enemy
   */
  markEnemyCrushed() {
    this.crushedEnemy = true;
  }

  /**
   * Get center position
   */
  getCenter() {
    return {
      x: this.x + TILE_SIZE / 2,
      y: this.y + TILE_SIZE / 2
    };
  }
}
