# Dig Dug

A faithful recreation of the classic 1982 Dig Dug arcade game using vanilla JavaScript and HTML5 Canvas.

## Features

- ✅ Authentic arcade gameplay mechanics
- ✅ Procedural level generation for infinite replayability
- ✅ Classic enemies: Pooka and Fygar with full AI
- ✅ Rock dropping mechanics with physics
- ✅ Pump attack system with sprite animations
- ✅ Fygar fire-breathing attacks
- ✅ Enemy ghost mode (move through dirt)
- ✅ Progressive difficulty scaling
- ✅ High score tracking (localStorage)
- ✅ Pixel-perfect sprite rendering (70+ sprites)
- ✅ Animated intro sequence
- ✅ Responsive controls

## Installation

```bash
npm install digdug-game
```

## Usage

### As an npm package

```javascript
import DigDug from 'digdug-game';

const game = new DigDug({
    container: document.getElementById('game'),
    width: 448,
    height: 448,
    scale: 2,
    onGameOver: (score) => console.log('Game Over!', score),
    onLevelComplete: (level) => console.log('Level Complete!', level),
    onScoreChange: (score) => console.log('Score:', score),
});

game.start();
```

### Configuration Options

- `container` (HTMLElement, required): DOM element to attach the game canvas
- `width` (number, default: 448): Game width in pixels
- `height` (number, default: 448): Game height in pixels
- `scale` (number, default: 1): Pixel scaling factor for larger displays
- `debug` (boolean, default: false): Show debug information (hitboxes, grid)
- `onGameOver` (function): Callback when game ends
- `onLevelComplete` (function): Callback when level is completed
- `onScoreChange` (function): Callback when score changes

## Controls

- **Arrow Keys** or **WASD**: Move Dig Dug
- **Space Bar**: Pump attack (hold to extend, release to retract)
- **ESC**: Pause/Resume game
- **Space** (on menu/game over): Start game

## Gameplay

### Objective

Defeat all enemies on each level by either:

1. Pumping them until they inflate and pop
2. Dropping rocks on them

### Enemies

**Pooka** (Red with goggles)

- Can move through dirt (ghost mode after 5-10 seconds)
- Worth 200 points base + distance bonus
- Speed: 0.7 in tunnels, 0.5 when ghosting

**Fygar** (Green dragon)

- Can breathe horizontal fire (3-tile range)
- Ghost mode activates after 10 seconds
- Worth 400 points base + distance bonus
- Speed: 0.6 in tunnels, 0.4 when ghosting

### Scoring

- **Enemy defeat**: Base points + distance bonus
- **Rock kill**: 1000 points
- **Bonus items**: 500 points (appear after dropping 2 rocks)
- **Distance multiplier**: Farther enemies are worth more points

### Strategy Tips

1. Dig strategic tunnels to control enemy movement
2. Lure enemies under rocks
3. Drop 2 rocks per level to spawn bonus items
4. Defeat distant enemies for bonus points
5. Use rocks to defeat multiple enemies at once

## Development

### Install dependencies

```bash
npm install
```

### Run development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Project Structure

```
digdug/
├── src/
│   ├── index.js              # Main entry point & exports
│   ├── Game.js               # Core game loop & state machine
│   ├── Renderer.js           # Canvas rendering & sprite system
│   ├── entities/             # Game entities
│   │   ├── Player.js         # Player movement, digging, pump attack
│   │   ├── Enemy.js          # Base enemy AI & ghost mode
│   │   ├── Pooka.js          # Red enemy subclass
│   │   ├── Fygar.js          # Green dragon with fire breath
│   │   └── Rock.js           # Physics-based falling rocks
│   ├── systems/              # Game systems
│   │   ├── InputManager.js   # Keyboard input handling
│   │   ├── CollisionSystem.js # AABB collision detection
│   │   ├── LevelManager.js   # Procedural level generation
│   │   └── ScoreManager.js   # Score, lives, high scores
│   └── utils/                # Utilities
│       ├── constants.js      # Game configuration
│       ├── Grid.js           # Tile-based world grid
│       └── loadImage.js      # Sprite loading utility
├── sprites/                  # Sprite assets (70+ images)
├── dist/                     # Built files
└── package.json
```

## Browser Compatibility

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

## Performance

- Targets 60 FPS on modern browsers
- Optimized rendering with pixel-perfect graphics
- Small bundle size (~50KB minified)

## License

MIT

## Credits

Based on the original Dig Dug arcade game by Namco (1982).

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
