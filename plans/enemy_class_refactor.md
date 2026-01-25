# Enemy Class Refactor - Implementation Plan

## Overview

Complete rewrite of the Enemy class with incremental testing at each phase. The current implementation has overly complex ghost mode timing, buggy tunnel detection, and confusing state transitions. This plan rebuilds the Enemy class from scratch with clear, testable behavior at each step.

## Critical Files to Modify

- [src/entities/Enemy.js](src/entities/Enemy.js) - Primary refactor target (rename to Enemy_original.js first)
- [src/entities/Pooka.js](src/entities/Pooka.js) - Update to use refactored Enemy (Phase 6)
- [src/entities/Fygar.js](src/entities/Fygar.js) - Update to use refactored Enemy (Phase 6)
- [src/systems/LevelManager.js](src/systems/LevelManager.js) - Modify enemy count for testing (Phase 1)
- [src/Game.js](src/Game.js) - May need to verify integration points

## Current System Analysis

### Tunnel Generation

- **Player start**: 3-tile cross at center (14, 10)
- **Enemy tunnels**: 4-5 tiles long, randomly horizontal or vertical
- **Spawn rules**:
    - 8 tiles minimum between enemy tunnels
    - 10 tiles minimum from player start
    - Enemies spawn at middle of their tunnel

### Current Enemy Problems

1. **Ghost mode timer complexity**: Resets on tunnel entry, has fallback timeout, unclear state transitions
2. **Grid snapping bugs**: Snapping logic runs every frame, can cause jittering
3. **Tunnel direction detection**: Overly complex, uses separate tracking variables
4. **Movement restrictions**: Confusing logic mixing `inTunnel`, `canGhostMode`, `isGhosting`

### Grid & Collision Systems (Keep as-is)

- Grid: 28×20 tiles, 16×16 pixels each
- `pixelToGrid(x, y)` converts positions to grid coordinates
- `isEmpty(gx, gy)` checks if tile is empty (tunnel)
- `isRock(gx, gy)` checks if tile is a rock/boulder
- Enemies **cannot move through rocks** in any mode

---

## Phase 1: Basic Tunnel Movement (Single Enemy)

### Goal

Spawn 1 enemy that moves back and forth in its starting tunnel without ghost mode or player tracking.

### Implementation Steps

1. **Backup current Enemy.js**
    - Rename `src/entities/Enemy.js` to `src/entities/Enemy_original.js`

2. **Create new Enemy.js with minimal constructor**

    ```javascript
    export class Enemy {
        constructor(x, y, type, speed, level = 1) {
            // Position (pixel coordinates)
            this.x = x;
            this.y = y;

            // Type and level
            this.type = type;
            this.level = level;

            // Speed (increases with level)
            this.baseSpeed = speed;
            this.speed = speed + (level - 1) * 0.1;

            // Movement state
            this.direction = DIRECTIONS.DOWN;
            this.isMoving = true;

            // Animation
            this.animationFrame = 0;
            this.animationTimer = 0;

            // Inflation (when pumped)
            this.isInflating = false;
            this.inflateLevel = 1.0;
            this.inflateTimer = 0;

            // Destruction flag
            this.isDestroyed = false;
        }
    }
    ```

3. **Implement basic tunnel-only movement**
    - `update(deltaTime, player, grid)`: Only handle animation, inflation check, and movement
    - `move(grid)`:
        - Calculate new position based on direction
        - Check if new position is valid (in tunnel, not rock)
        - If invalid, reverse direction (bounce back)
        - Apply grid snapping for tunnel centering
    - `canMoveToPosition(x, y, grid)`: Return `!isRock && isEmpty`

4. **Grid snapping logic** (same as current)
    - When moving horizontally: snap Y to grid center
    - When moving vertically: snap X to grid center
    - Only snap if destination is still in tunnel

5. **Modify LevelManager.js**
    - Change `spawnEnemies()` to spawn only 1 enemy (hardcoded for testing)
    - Comment: `// TESTING: Spawning only 1 enemy for Phase 1`

### Testing Criteria

- [ ] Single enemy spawns in middle of its 4-5 tile tunnel
- [ ] Enemy moves back and forth in tunnel, reversing at ends
- [ ] Enemy stays perfectly centered in tunnel (no visual overlap with dirt)
- [ ] Enemy cannot move through dirt
- [ ] Enemy cannot move through rocks
- [ ] Enemy bounces at tunnel boundaries

### User Approval Required

Test and approve basic tunnel movement before proceeding to Phase 2.

---

## Phase 2: Player Tracking & Seeking in Tunnels

### Goal

Enemy actively seeks player when within range, still confined to tunnels.

### Implementation Steps

1. **Add AI state tracking**

    ```javascript
    // Add to constructor
    this.state = 'roaming'; // 'roaming' or 'chasing'
    this.stateTimer = 0;
    this.directionChangeTimer = 0;
    ```

2. **Implement player distance detection**
    - Calculate distance to player in `update()`
    - If player within 8 tiles (128 pixels): switch to 'chasing'
    - If player beyond 10 tiles (160 pixels): switch to 'roaming'
    - Use Euclidean distance: `Math.sqrt(dx*dx + dy*dy)`

3. **Implement chasing behavior**
    - `chasePlayer(player, grid)`: Calculate direction toward player
    - Choose primary axis (larger delta)
    - Check if that direction has a tunnel
    - If blocked, try perpendicular direction
    - If both blocked, stay in place

4. **Implement roaming behavior**
    - `roam(grid)`: Pick random valid tunnel direction every 1-2 seconds
    - `pickValidDirection(grid)`: Check all 4 directions for tunnels, pick randomly

5. **Add direction validation**
    - `getValidTunnelDirections(grid)`: Returns array of directions with tunnels
    - Used by both chasing and roaming

### Testing Criteria

- [ ] Enemy ignores player when far away (>10 tiles)
- [ ] Enemy starts chasing when player digs within 8 tiles
- [ ] Enemy follows player through tunnel intersections
- [ ] Enemy picks sensible paths toward player (shortest route in tunnels)
- [ ] Enemy stops at dead ends, doesn't try to move through dirt
- [ ] Roaming behavior looks natural when player is far

### User Approval Required

Test and approve seeking behavior before proceeding to Phase 3.

---

## Phase 3: Player-Dug Tunnel Expansion

### Goal

Enemy can navigate through tunnels the player creates by digging.

### Implementation Steps

1. **No code changes needed**
    - Enemy already uses `grid.isEmpty()` which detects player-dug tunnels
    - Validation: Test that chasing works when player digs new paths

2. **Testing focus**
    - Dig toward enemy tunnel, verify enemy enters new tunnel
    - Create intersection, verify enemy takes correct path toward player
    - Dig escape route, verify enemy follows

### Testing Criteria

- [ ] Enemy enters player-dug tunnels immediately when connected
- [ ] Enemy chases through complex player-dug tunnel networks
- [ ] Enemy navigates intersections correctly
- [ ] No bugs when tunnels merge or create loops

### User Approval Required

Test and approve tunnel expansion navigation before proceeding to Phase 4.

---

## Phase 4: Ghost Mode Implementation

### Goal

After 8 seconds, enemy can enter ghost mode to move through dirt and seek player anywhere.

### Implementation Steps

1. **Add ghost mode state**

    ```javascript
    // Add to constructor
    this.ghostModeTimer = 0;
    this.canGhostMode = false;
    this.isGhosting = false;
    this.GHOST_MODE_DELAY = 8000; // 8 seconds
    ```

2. **Ghost mode timer logic**
    - In `update()`: Increment `ghostModeTimer` by deltaTime
    - After 8 seconds: `canGhostMode = true`
    - **When entering tunnel**: Reset `ghostModeTimer = 0`, `canGhostMode = false`, `isGhosting = false`

3. **Tunnel detection**
    - Track previous position's tunnel state
    - If `wasInDirt && nowInTunnel`: Reset ghost timer

4. **Ghost mode activation**
    - When `canGhostMode && playerInDirt`: Enter ghost mode
    - Set `isGhosting = true` for rendering
    - Speed reduced to 60% while ghosting: `moveSpeed = this.speed * 0.6`

5. **Ghost mode movement**
    - `canMoveToPosition()`: Allow dirt if `canGhostMode`, still block rocks
    - Move directly toward player (ignore tunnels)
    - Chase logic uses straight-line path

6. **Ghost mode deactivation**
    - When `isGhosting && touchTunnel`:
        - `isGhosting = false`
        - `ghostModeTimer = 0`
        - `canGhostMode = false`
        - Resume tunnel-based movement

### Testing Criteria

- [ ] Enemy waits 8 seconds before ghost mode available
- [ ] Ghost mode activates when player not in tunnels
- [ ] Ghosting enemy has flashing eyes (rendering verified)
- [ ] Ghost moves at 60% speed through dirt
- [ ] Ghost cannot move through rocks
- [ ] Ghost seeks player directly (not following tunnels)
- [ ] Touching tunnel cancels ghost mode
- [ ] 8-second timer resets after tunnel touch
- [ ] Cannot re-ghost for another 8 seconds

### User Approval Required

Test and approve ghost mode before proceeding to Phase 5.

---

## Phase 5: Multiple Enemies (4 for Level 1)

### Goal

Restore normal enemy count, verify all behaviors work with multiple enemies.

### Implementation Steps

1. **Modify LevelManager.js**
    - Remove hardcoded enemy count
    - Restore original `numEnemies` calculation:
        ```javascript
        const numEnemies = Math.min(
            LEVEL.START_ENEMIES + (levelNumber - 1) * LEVEL.ENEMY_INCREMENT,
            LEVEL.MAX_ENEMIES
        );
        ```

2. **Testing focus**
    - All 4 enemies behave independently
    - Ghost timers are independent
    - No collision between enemies
    - Performance is smooth

### Testing Criteria

- [ ] 4 enemies spawn in separate tunnels
- [ ] Each enemy has independent AI state
- [ ] Multiple enemies can chase player simultaneously
- [ ] Ghost timers are independent (not synchronized)
- [ ] No performance issues or stuttering
- [ ] Enemies don't block each other in tunnels

### User Approval Required

Test and approve multiple enemy behavior before proceeding to Phase 6.

---

## Phase 6: Integrate Pooka & Fygar Subclasses

### Goal

Update Pooka and Fygar to extend the refactored Enemy class.

### Implementation Steps

1. **Update Pooka.js**
    - Verify constructor calls `super(x, y, 'pooka', ENEMY.POOKA.SPEED, level)`
    - Remove any overridden movement methods from original
    - Keep animation/rendering specific to Pooka

2. **Update Fygar.js**
    - Verify constructor calls `super(x, y, 'fygar', ENEMY.FYGAR.SPEED, level)`
    - Keep fire-breathing logic (separate from movement)
    - Remove any overridden movement methods from original

3. **Test enemy type distribution**
    - Level 1: 80% Pooka, 20% Fygar (from LevelManager calculation)
    - Verify both types use refactored movement correctly

### Testing Criteria

- [ ] Pookas spawn and move correctly
- [ ] Fygars spawn and move correctly
- [ ] Both types have correct speeds (Pooka: 1.1, Fygar: 1.0)
- [ ] Both types can ghost mode
- [ ] Fygar fire-breathing still works (independent of movement)
- [ ] Correct ratio of Pooka/Fygar at level 1

### User Approval Required

Final testing and approval before considering Enemy refactor complete.

---

## Phase 7: Future Enhancements (Separate Plan)

After all phases approved, create separate plans for:

1. **Fygar Fire-Breathing Improvements**
    - Timing adjustments
    - Range/damage tuning
    - Visual effects

2. **Enemy Sprites & Animation**
    - Dedicated Pooka sprites
    - Dedicated Fygar sprites
    - Improved ghost mode rendering
    - Death/inflation animations

---

## Verification Strategy

### End-to-End Testing After Each Phase

1. Start new game
2. Observe enemy behavior for 30 seconds
3. Dig toward enemy, test interaction
4. Let enemy chase, verify seeking
5. Test ghost mode timing (Phase 4+)
6. Verify pump/inflation still works
7. Verify rock crushing still works

### Regression Checks

- Player movement unaffected
- Rock physics unchanged
- Collision detection working
- Score system intact
- Level progression working

### Performance Validation

- Smooth 60 FPS with multiple enemies
- No memory leaks from old Enemy instances
- No console errors

---

## Rollback Plan

If any phase fails:

1. Revert `src/entities/Enemy.js` to previous phase version
2. Restore `Enemy_original.js` if needed
3. Debug specific issue before proceeding
4. Keep `Enemy_original.js` as reference until Phase 6 complete

---

## Implementation Notes

### Constants to Use

- `TILE_SIZE = 16` (pixels per tile)
- `DIRECTIONS.UP/DOWN/LEFT/RIGHT` (from constants.js)
- `ENEMY.POOKA.SPEED = 1.1`
- `ENEMY.FYGAR.SPEED = 1.0`

### Grid Methods to Use

- `grid.pixelToGrid(x, y)` - Convert position to grid coordinates
- `grid.isEmpty(gx, gy)` - Check if tile is tunnel
- `grid.isRock(gx, gy)` - Check if tile is rock
- `grid.isDirt(gx, gy)` - Check if tile is dirt

### Direction Management

- Store direction as DIRECTIONS constant
- Validate before moving
- Reverse on collision (Phase 1)
- Pick intelligently (Phase 2+)

### Rendering Integration

- `this.isGhosting` flag used by Renderer.js for eye flashing effect
- Keep animation frame tracking for sprite cycling
- Inflation rendering handled by existing system
