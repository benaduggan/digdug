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

- **Grid.js** manages a 28×28 tile array (TILE_TYPES: EMPTY, DIRT, ROCK)
- Tile size: 16×16 pixels = 448×448px total canvas
- **Critical conversion**: Use `grid.pixelToGrid(x, y)` for entity positions → grid coords
- Player digging automatically converts dirt tiles to empty

### Enemy AI State Machine

Enemies have three critical states:

1. **Roaming**: Random movement in tunnels
2. **Ghost Mode**: Can move through dirt at reduced speed (0.6× for Pooka, 0.4× for Fygar)
3. **Chasing**: Follows player position

**Ghost Mode Timer Logic** (src/entities/Enemy.js):

- Timer starts at spawn
- After 5 seconds (`GHOST_MODE_DELAY`), `canGhostMode = true`
- **Critical**: Timer resets to 0 when entering a tunnel from dirt
- When in tunnel without ghost mode, enemy follows detected tunnel direction (horizontal/vertical)

### Rock Physics System

Rocks have a precise trigger and fall sequence:

1. Player must touch rock from below (within 4px vertical overlap)
2. Rock shakes for 800ms (`ROCK.SHAKE_DURATION`)
3. Rock falls at `ROCK.FALL_SPEED` (3 pixels/frame)
4. **Crumbling**: If rock hits dirt without crushing an enemy, it plays crumble animation and disappears
5. If rock crushes enemy, it stays in place and `grid.placeRock()` is called

**Critical**: Use `rock.markEnemyCrushed()` in collision detection to prevent crumbling.

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
2. Draw dirt tiles (with depth-based color gradients)
3. Draw rocks (with shake offset if `rock.isShaking`)
4. Draw rock crumble animation (if `rock.isCrumbling`)
5. Draw enemies (with ghost mode flashing eyes)
6. Draw player (with pump animation)
7. Draw UI (score, lives, level)

**Font**: All text uses `"Press Start 2P"` from Google Fonts (loaded in index.html)

### Collision Detection

CollisionSystem uses AABB (axis-aligned bounding box):

- Player-Enemy: 12px overlap threshold
- Rock-Entity: Center point distance check
- Pump-Enemy: Range-based (PLAYER.PUMP_RANGE = 64px)

## Critical Constants

### Speed Values (src/utils/constants.js)

```javascript
PLAYER.SPEED = 2;
ENEMY.POOKA.SPEED = 0.8; // Base speed in tunnels
ENEMY.POOKA.GHOST_SPEED = 0.5; // Speed through dirt
ENEMY.FYGAR.SPEED = 0.7;
ENEMY.FYGAR.GHOST_SPEED = 0.4;
```

### Timing Values

```javascript
GHOST_MODE_DELAY = 5000; // 5 seconds before enemies can ghost
ROCK.SHAKE_DURATION = 800; // Rock shake time before fall
ROCK.FALL_DELAY = 800; // (same value)
```

## Common Pitfalls

1. **Game Loop Stacking**: Always `cancelAnimationFrame(this.animationFrameId)` before starting new loop
2. **Event Listener Accumulation**: Use flags like `menuListenerAdded` to prevent duplicate listeners
3. **Grid Coordinate Confusion**: Never use pixel coordinates for grid operations; always convert first
4. **Enemy Spawning in Dirt**: Enemies must spawn in empty tiles (tunnels), check with `grid.isEmpty()`
5. **Rock Crumbling Logic**: Mark `rock.crushedEnemy = true` when collision occurs, otherwise rock will crumble on dirt impact
6. **Ghost Mode Reset**: Must reset `ghostModeTimer = 0` when transitioning from dirt to tunnel

## Game State Flow

```
MENU → (Space key) → PLAYING → (all enemies defeated) → LEVEL_COMPLETE → (next level) → PLAYING
                              → (player dies, lives > 0) → PLAYING (restart level)
                              → (player dies, lives = 0) → GAME_OVER → (Space key) → MENU
```

## NPM Package Configuration

This project builds as an npm package using Vite:

- **Entry point**: src/index.js (exports Game class)
- **Output formats**: ES modules and UMD (vite.config.js)
- **Library name**: `DigDug` (global variable for UMD)
- **Development**: Auto-initializes if `#game` element exists in DOM
