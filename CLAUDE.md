# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
npm run dev      # Start Vite dev server on http://localhost:5173
npm run build    # Build for production (outputs to dist/)
npm run preview  # Preview production build
```

## Architecture Overview

### Game Loop Architecture

The game uses a classic game loop pattern driven by `requestAnimationFrame`:

- **Game.js** orchestrates the loop: `update()` → `render()` → repeat
- **Critical**: Always cancel previous `animationFrameId` before starting a new loop to prevent speed multiplication bugs
- Delta time is calculated between frames and passed to all entity updates

### Entity-Component-System Pattern

- **Entities**: Player, Enemy (base), Pooka, Fygar, Rock
- **Systems**: InputManager, CollisionSystem, LevelManager, ScoreManager
- **Components**: Implicit (properties/state on entities)

### Grid-Based World

- **Grid.js** manages a 27×18 tile array (TILE_TYPES: EMPTY, DIRT, ROCK)
- Tile size: 16×16 pixels = 432×288px total canvas
- Top 2 rows are sky (blue background, no collision)
- **Critical conversion**: Use `grid.pixelToGrid(x, y)` for entity positions → grid coords
- Player digging automatically converts dirt tiles to empty

### Enemy AI State Machine

Enemies have three critical states:

1. **Roaming**: Random movement in tunnels (1-2 seconds between direction changes)
2. **Ghost Mode**: Can move through dirt at reduced speed
3. **Chasing**: Follows player when within 128px (8 tiles)

**Ghost Mode Timer Logic** (src/entities/Enemy.js):

- Timer starts at spawn
- Pooka: 5-10 seconds (randomized) before `canGhostMode = true`
- Fygar: 10 seconds fixed before ghost mode
- **Critical**: Timer resets to 0 when entering a tunnel from dirt
- Minimum ghost duration: 1.2 seconds before exiting
- Ghost timer pauses while Fygar is charging/breathing fire

**Fygar Fire Breathing** (src/entities/Fygar.js):

- Triggers when player is horizontally aligned (±12px) and within 64px
- State machine: Ready → Charging (300ms) → Firing (450ms) → Cooldown (2.5s)
- Fire extends progressively: 1 tile → 2 tiles → 3 tiles
- Cancels if Fygar is pumped or enters ghost mode

### Rock Physics System

Rocks have a precise trigger and fall sequence:

1. Player must touch rock from below (within 4px vertical overlap)
2. Rock shakes for 200ms (`ROCK.SHAKE_DURATION`)
3. Rock waits for player to clear, then 300ms delay (`ROCK.FALL_DELAY`)
4. Rock falls at `ROCK.FALL_SPEED` (3 pixels/frame)
5. **On landing**:
    - If crushed enemy: stays in place, 500ms delay, then 300ms crumble animation
    - If hit dirt: immediate 300ms crumble animation then destroys
    - If hit rock/bottom: stops falling

**Critical**: Use `rock.markEnemyCrushed()` in collision detection to prevent immediate crumbling.

### Level Generation (Procedural)

LevelManager generates levels in two phases:

1. **Tunnel Generation** (`generateTunnels()`): Creates connected horizontal/vertical pathways
2. **Rock Placement** (`placeRocksAfterEnemies()`): Places rocks AFTER enemies spawn

**Rock Placement Constraints**:

- Minimum 8 tiles between rocks (`minRockDistance`)
- Minimum 3 tiles from tunnels (`minPathDistance`)
- Minimum 6 tiles from enemies (`minEnemyDistance`)
- **Guaranteed minimum**: 3 rocks per level with progressive constraint relaxation if placement fails

**Enemy Spawning**:

- Enemies MUST spawn in tunnels (empty tiles), never in dirt
- Minimum 8 tiles away from player start (top-left)
- Minimum 4 tiles between enemies

### Rendering Pipeline

Renderer.js uses layered drawing order:

1. Clear canvas (black background)
2. Draw dirt tiles (with depth-based HSL color gradients + procedural noise texture)
3. Draw rocks (with shake offset if `rock.isShaking`)
4. Draw rock crumble animation (if `rock.isCrumbling`)
5. Draw enemies (with ghost mode flashing eyes, inflation stages)
6. Draw player (with pump hose/nozzle if pumping)
7. Draw Fygar fire (if breathing)
8. Draw UI (score, hi-score, lives, level indicators)

**Font**: All text uses `"Press Start 2P"` from Google Fonts (loaded in index.html)

**Performance**: Background (dirt) is cached to a separate canvas and only redrawn when grid state changes (hash-based invalidation)

### Sprite System

70+ sprites organized by entity:

- **Player**: Walking (4), Digging (4), Pumping (4), Shooting (2), Dying (10), Smooshed (2)
- **Pooka**: Walking (2), Ghosting (2), Inflating (3), Popped (1), Smooshed (1)
- **Fygar**: Walking (2), Ghosting (2), Fire (3), Inflating (3), Popped (1), Smooshed (1)
- **Pump Equipment**: Hose lines (2), Nozzles (2)
- **Props**: Rock (2), Crumbling (2), Flowers (3)
- **UI**: Title image, Bonus items (11)

**Animation**: Frame-based with 150ms default duration per frame (`ANIMATION.FRAME_DURATION`)

### Collision Detection

CollisionSystem uses AABB (axis-aligned bounding box):

- Player-Enemy: AABB with 6px buffer (4px minimum overlap)
- Rock-Entity: Full 16×16 AABB collision
- Pump-Enemy: Line-to-circle perpendicular distance (9.6px hit radius)
- Fygar Fire-Player: AABB on fire hitbox (varies by fire extent)
- Bonus Item-Player: Full AABB collision

## Critical Constants

### Speed Values (src/utils/constants.js)

```javascript
PLAYER.SPEED = 1.2; // Pixels per frame
ENEMY.POOKA.SPEED = 0.7; // Base speed in tunnels
ENEMY.POOKA.GHOST_SPEED = 0.5; // Speed through dirt
ENEMY.FYGAR.SPEED = 0.6;
ENEMY.FYGAR.GHOST_SPEED = 0.4;
```

### Timing Values

```javascript
ENEMY.MIN_GHOST_DURATION = 1200; // Must ghost for at least 1.2 seconds
ENEMY.POOKA.GHOST_MODE_DELAY = 5000 - 10000; // Randomized
ENEMY.FYGAR.GHOST_MODE_DELAY = 10000;
ENEMY.FYGAR.FIRE_CHARGE_TIME = 300; // ms pause before fire
ENEMY.FYGAR.FIRE_DURATION = 450; // ms fire stays active
ENEMY.FYGAR.FIRE_COOLDOWN = 2500; // ms between breaths
ROCK.SHAKE_DURATION = 200; // Rock shake time before fall
ROCK.FALL_DELAY = 300; // Delay after player clears
```

### Player Pump Values

```javascript
PLAYER.PUMP_RANGE = 48; // TILE_SIZE * 3 = 48px max range
// Pump extends at 4px/frame, retracts at 8px/frame
// 200ms cooldown at full length, 800ms cooldown after release
```

## Common Pitfalls

1. **Game Loop Stacking**: Always `cancelAnimationFrame(this.animationFrameId)` before starting new loop
2. **Event Listener Accumulation**: Use flags like `menuListenerAdded` to prevent duplicate listeners
3. **Grid Coordinate Confusion**: Never use pixel coordinates for grid operations; always convert first
4. **Enemy Spawning in Dirt**: Enemies must spawn in empty tiles (tunnels), check with `grid.isEmpty()`
5. **Rock Crumbling Logic**: Mark `rock.crushedEnemy = true` when collision occurs, otherwise rock will crumble on dirt impact
6. **Ghost Mode Reset**: Must reset `ghostModeTimer = 0` when transitioning from dirt to tunnel
7. **Fygar Fire Timer**: Ghost mode timer must pause while Fygar is in charging/firing state
8. **Pump State Management**: Player cannot move while pump is extended; cooldowns must be tracked separately

## Game State Flow

```
MENU → (Space key) → INTRO → (animation complete) → PLAYING
PLAYING → (all enemies defeated) → LEVEL_COMPLETE → (next level) → INTRO → PLAYING
PLAYING → (player dies) → DYING → (animation complete) → RESPAWNING → (3 sec) → PLAYING
PLAYING → (player dies, lives = 0) → DYING → GAME_OVER → (Space key) → MENU
PLAYING → (ESC key) → PAUSED → (ESC key) → PLAYING
```

### Game States (8 total)

1. **MENU**: Title screen with "1 PLAYER" text
2. **INTRO**: Animated sequence (walk left, dig down, ready pose)
3. **PLAYING**: Active gameplay
4. **PAUSED**: Game paused (ESC key)
5. **DYING**: Death animation (1 second)
6. **RESPAWNING**: "Player 1 Ready" display (3 seconds)
7. **LEVEL_COMPLETE**: Level completion screen
8. **GAME_OVER**: Score display with restart instruction

## NPM Package Configuration

This project builds as an npm package using Vite:

- **Entry point**: src/index.js (exports Game class)
- **Output formats**: ES modules and UMD (vite.config.js)
- **Library name**: `DigDug` (global variable for UMD)
- **Development**: Auto-initializes if `#game` element exists in DOM

## Death and Respawn System

**Death Animation** (src/entities/Player.js):

- Duration: 1000ms (`DEATH.ANIMATION_DURATION`)
- Two types: particle explosion (enemy kill) or squish (rock crush)
- Player sprite changes through dying frames

**Respawn Sequence**:

- "Player 1 Ready" displayed for 3 seconds (`DEATH.RESPAWN_DELAY`)
- Player respawns at level start position
- 2 seconds invincibility with flicker effect (`DEATH.INVINCIBILITY_TIME`)

## Enemy Inflation System

When pump hits an enemy:

- Inflation progresses over 1.2 seconds (3 stages)
- Sprites grow: 16×16 → 20×20 → 21×21
- If pump released before full inflation: deflates over 1.5 seconds
- At full inflation: enemy pops (400ms "popped" sprite, then removed)
- Inflating enemies cannot move or attack
