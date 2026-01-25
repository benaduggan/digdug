export class InputManager {
  constructor() {
    this.keys = new Set();
    this.keysPressed = new Set(); // For single-press detection
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  /**
   * Initialize input listeners
   */
  init() {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  /**
   * Handle key down event
   */
  handleKeyDown(e) {
    if (!this.keys.has(e.code)) {
      this.keysPressed.add(e.code);
    }
    this.keys.add(e.code);

    // Prevent default behavior for game keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }

  /**
   * Handle key up event
   */
  handleKeyUp(e) {
    this.keys.delete(e.code);
    this.keysPressed.delete(e.code);
  }

  /**
   * Check if key is currently held down
   */
  isKeyDown(code) {
    return this.keys.has(code);
  }

  /**
   * Check if key was just pressed (single press detection)
   */
  isKeyPressed(code) {
    const pressed = this.keysPressed.has(code);
    if (pressed) {
      this.keysPressed.delete(code);
    }
    return pressed;
  }

  /**
   * Check if up arrow or W is pressed
   */
  isUpPressed() {
    return this.isKeyDown('ArrowUp') || this.isKeyDown('KeyW');
  }

  /**
   * Check if down arrow or S is pressed
   */
  isDownPressed() {
    return this.isKeyDown('ArrowDown') || this.isKeyDown('KeyS');
  }

  /**
   * Check if left arrow or A is pressed
   */
  isLeftPressed() {
    return this.isKeyDown('ArrowLeft') || this.isKeyDown('KeyA');
  }

  /**
   * Check if right arrow or D is pressed
   */
  isRightPressed() {
    return this.isKeyDown('ArrowRight') || this.isKeyDown('KeyD');
  }

  /**
   * Check if space bar is pressed
   */
  isSpacePressed() {
    return this.isKeyDown('Space');
  }

  /**
   * Get movement direction from input
   */
  getDirection() {
    if (this.isUpPressed()) return 'up';
    if (this.isDownPressed()) return 'down';
    if (this.isLeftPressed()) return 'left';
    if (this.isRightPressed()) return 'right';
    return null;
  }

  /**
   * Clean up listeners
   */
  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    this.keys.clear();
    this.keysPressed.clear();
  }
}
