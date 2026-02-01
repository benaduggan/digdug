# Scoring System Implementation Plan

## Overview

This plan outlines the changes needed to implement the new arcade-accurate scoring system for the Dig Dug game.

## Current State

- **ScoreManager.js**: Has `addEnemyKill()`, `addRockKill()`, `addBonusItem()` methods with flat scoring
- **constants.js**: Has `SCORES` object with base values (not depth-based)
- **Game.js**: Calls scoring methods but doesn't pass depth information
- **Score display**: No floating score display currently exists

## Changes Required

### 1. Update SCORES Constants in `src/utils/constants.js`

Replace the current `SCORES` object with depth-based scoring:

```javascript
export const SCORES = {
    DIG_TILE: 10,

    // Depth-based pump kill scores (by quarter of dirt area)
    // Grid rows 2-17 are dirt (16 rows), divided into 4 quarters of 4 rows each
    PUMP_KILL: {
        // Quarter 1: rows 2-5 (top)
        // Quarter 2: rows 6-9
        // Quarter 3: rows 10-13
        // Quarter 4: rows 14-17 (bottom)
        POOKA: [200, 300, 400, 500], // Points by depth quarter
        FYGAR: [200, 300, 400, 500], // Normal kill (vertical)
        FYGAR_HORIZONTAL: [400, 600, 800, 1000], // Horizontal kill (2x)
    },

    // Rock kill scores (based on number of enemies killed by same rock)
    ROCK_KILL: [0, 1000, 2500, 4000, 6000, 8000, 10000, 12000, 15000],
    // Index 0 unused, index 1 = 1 enemy, index 8+ = 8+ enemies

    // Prize/bonus item values
    BONUS_ITEMS: [
        400, 600, 800, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000,
    ],
    // Index matches prize_1 through prize_11
};
```

### 2. Update ScoreManager in `src/systems/ScoreManager.js`

Modify methods to use new scoring rules:

**a) Add `addDigScore()` method:**

```javascript
addDigScore() {
    this.addScore(SCORES.DIG_TILE);
    return SCORES.DIG_TILE;
}
```

**b) Modify `addEnemyKill()` to accept depth and direction:**

```javascript
addEnemyKill(enemyType, enemyY, isHorizontalKill = false) {
    const depthQuarter = this.getDepthQuarter(enemyY);
    let points;

    if (enemyType === ENEMY_TYPES.FYGAR && isHorizontalKill) {
        points = SCORES.PUMP_KILL.FYGAR_HORIZONTAL[depthQuarter];
    } else if (enemyType === ENEMY_TYPES.FYGAR) {
        points = SCORES.PUMP_KILL.FYGAR[depthQuarter];
    } else {
        points = SCORES.PUMP_KILL.POOKA[depthQuarter];
    }

    this.addScore(points);
    return points;
}
```

**c) Add `getDepthQuarter()` helper:**

```javascript
getDepthQuarter(pixelY) {
    // Dirt starts at row 2, ends at row 17 (16 rows total)
    // Divide into 4 quarters of 4 rows each
    const gridY = Math.floor(pixelY / TILE_SIZE);
    const dirtStartRow = 2;
    const dirtRows = 16; // rows 2-17
    const quarterSize = dirtRows / 4; // 4 rows per quarter

    const relativeRow = Math.max(0, gridY - dirtStartRow);
    const quarter = Math.min(3, Math.floor(relativeRow / quarterSize));

    return quarter;
}
```

**d) Modify `addRockKill()` to accept enemy count:**

```javascript
addRockKill(enemyCount) {
    // Cap at index 8 for 8+ enemies
    const index = Math.min(enemyCount, 8);
    const points = SCORES.ROCK_KILL[index];
    this.addScore(points);
    return points;
}
```

**e) Modify `addBonusItem()` to accept bonus index:**

```javascript
addBonusItem(bonusIndex) {
    // bonusIndex is 0-based, maps to prize_1 through prize_11
    const safeIndex = Math.min(bonusIndex, SCORES.BONUS_ITEMS.length - 1);
    const points = SCORES.BONUS_ITEMS[safeIndex];
    this.addScore(points);
    return points;
}
```

### 3. Track Rock Kill Count in `src/entities/Rock.js`

Add a counter for enemies crushed by this rock:

```javascript
// In constructor:
this.enemiesKilled = 0;

// New method:
incrementKillCount() {
    this.enemiesKilled++;
    return this.enemiesKilled;
}
```

### 4. Update Game.js Scoring Calls

**a) Add dig scoring** - Track when tiles actually get dug:

In `update()` method, before calling `player.update()`:

```javascript
const previousDirtCount = this.countDirtTiles(); // or track specific tile
this.player.update(deltaTime, this.inputManager, this.grid);
const currentDirtCount = this.countDirtTiles();
if (currentDirtCount < previousDirtCount) {
    this.scoreManager.addDigScore();
    this.config.onScoreChange(this.scoreManager.score);
}
```

Alternative: Modify Grid.dig() to return true only when dirt is actually removed, then track in Player.

**b) Update pump kill scoring** - Pass enemy position and pump direction:

```javascript
// When enemy is destroyed by pumping (not smooshed)
const isHorizontalKill =
    enemy.lastPumpDirection === 'left' || enemy.lastPumpDirection === 'right';
const points = this.scoreManager.addEnemyKill(
    enemy.type,
    enemy.y,
    isHorizontalKill
);
this.spawnFloatingScore(points, enemy.x, enemy.y);
```

**c) Update rock kill scoring** - Track per-rock and score at end:

```javascript
// When rock-enemy collision detected:
rock.incrementKillCount();
// Store enemy position for score display
if (!rock.killPositions) rock.killPositions = [];
rock.killPositions.push({ x: enemy.x, y: enemy.y });

// When rock finishes (crumbles/lands):
if (rock.enemiesKilled > 0) {
    const points = this.scoreManager.addRockKill(rock.enemiesKilled);
    // Display score at last kill position
    const lastPos = rock.killPositions[rock.killPositions.length - 1];
    this.spawnFloatingScore(points, lastPos.x, lastPos.y);
}
```

**d) Update bonus item collection:**

```javascript
const points = this.scoreManager.addBonusItem(item.bonusIndex);
this.spawnFloatingScore(points, item.x, item.y);
```

### 5. Implement Floating Score Display

**a) Add score sprite sheet to Renderer.js:**

Load the sprite sheet:

```javascript
// In loadSprites():
this.scoreSheet = null;
loadImage('/assets/sprites/score_sheet.png').then((img) => {
    this.scoreSheet = img;
});
```

**b) Create score sprite mapping:**

Based on the sprite sheet layout (horizontal arrangement):

```javascript
// Score values and their sprite positions
// Sheet appears to show: 200, 300, 400, 500, 600, 800, 1000, ...
// Need to measure actual sprite positions
this.scoreSprites = {
    200: { x: 0, y: 0, w: 24, h: 8 },
    300: { x: 24, y: 0, w: 24, h: 8 },
    400: { x: 48, y: 0, w: 24, h: 8 },
    // ... etc
};
```

**c) Add floating scores array to Game.js:**

```javascript
// In constructor:
this.floatingScores = [];

// Method to spawn:
spawnFloatingScore(points, x, y) {
    this.floatingScores.push({
        points,
        x,
        y,
        timer: 0,
        duration: 1000, // 1 second display
    });
}

// In update():
this.floatingScores = this.floatingScores.filter(score => {
    score.timer += deltaTime;
    return score.timer < score.duration;
});
```

**d) Add drawFloatingScore() to Renderer.js:**

```javascript
drawFloatingScore(score) {
    if (!this.scoreSheet) return;

    const spriteInfo = this.getScoreSpriteInfo(score.points);
    if (!spriteInfo) return;

    // Center the score on the position
    const drawX = score.x + (TILE_SIZE - spriteInfo.w) / 2;
    const drawY = score.y;

    this.ctx.drawImage(
        this.scoreSheet,
        spriteInfo.x, spriteInfo.y, spriteInfo.w, spriteInfo.h,
        drawX, drawY, spriteInfo.w, spriteInfo.h
    );
}

getScoreSpriteInfo(points) {
    // Map points value to sprite sheet coordinates
    // Based on sprite sheet: ~, 200, 300, 400, 500, 600, 800, 1000, ...
    // (will need exact measurements from sprite)
    return this.scoreSprites[points] || null;
}
```

### 6. Track Pump Direction on Enemy

In `src/entities/Enemy.js`, add tracking for pump direction:

```javascript
// In constructor:
this.lastPumpDirection = null;

// When pumped (in inflate method or wherever pump hits):
setLastPumpDirection(direction) {
    this.lastPumpDirection = direction;
}
```

And update Player.js or wherever pump collision is detected to set this.

### 7. File Changes Summary

| File                          | Changes                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `src/utils/constants.js`      | Replace `SCORES` object with new depth/count based structure                                  |
| `src/systems/ScoreManager.js` | Update all scoring methods, add depth calculation                                             |
| `src/entities/Rock.js`        | Add `enemiesKilled` counter and `killPositions` array                                         |
| `src/entities/Enemy.js`       | Add `lastPumpDirection` property                                                              |
| `src/Game.js`                 | Update scoring calls, add dig tracking, add floating scores array, add `spawnFloatingScore()` |
| `src/Renderer.js`             | Load score sprite sheet, add `drawFloatingScore()` and score position mapping                 |

### 8. Implementation Order

1. **Phase 1: Constants & ScoreManager** - Update SCORES and scoring methods
2. **Phase 2: Dig Scoring** - Implement tile dig detection and scoring
3. **Phase 3: Pump Kill Scoring** - Add depth calculation, direction tracking
4. **Phase 4: Rock Kill Scoring** - Add multi-kill tracking per rock
5. **Phase 5: Bonus Items** - Update bonus scoring with correct values
6. **Phase 6: Floating Scores** - Load sprite sheet, implement display system

### 9. Score Sprite Sheet Analysis

Looking at the sprite sheet image:

- Row 1: `~` (tilde/wave), `200`, `300`, `400`, `500`, `600`, `800`, `1000`
- Row 2: `1000`, `2000`, `2500`, `3000`, `4000`, `5000`, `6000`
- Row 3: `7000`, `8000`, `10000`, `12000`, `15000`

Each score appears to be approximately 24-32 pixels wide and 8 pixels tall. Will need to measure exact coordinates when implementing.

### 10. Testing Checklist

- [ ] Digging a tile adds 10 points
- [ ] Pumping Pooka at different depths gives correct points (200/300/400/500)
- [ ] Pumping Fygar vertically gives same as Pooka
- [ ] Pumping Fygar horizontally gives 2x points
- [ ] Rock killing 1 enemy gives 1000 points
- [ ] Rock killing 2 enemies gives 2500 points (same rock)
- [ ] Rock killing 3+ enemies gives escalating points
- [ ] Bonus items give correct values based on prize index
- [ ] Floating scores display at enemy death location
- [ ] Floating scores disappear after 1 second
