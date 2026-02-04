export interface GameConfig {
    /** DOM element to attach the game canvas (default: document.body) */
    container?: HTMLElement;
    /** Game width in pixels (default: 432) */
    width?: number;
    /** Game height in pixels (default: 304) */
    height?: number;
    /** Pixel scaling factor for larger displays (default: 1) */
    scale?: number;
    /** Show debug information like hitboxes and grid (default: false) */
    debug?: boolean;
    /** Starting level number (default: 1) */
    level?: number;
    /** Callback when game ends with final score */
    onGameOver?: (score: number) => void;
    /** Callback when a level is completed */
    onLevelComplete?: (level: number) => void;
    /** Callback when score changes */
    onScoreChange?: (score: number) => void;
}

export type GameState =
    | 'menu'
    | 'intro'
    | 'playing'
    | 'paused'
    | 'dying'
    | 'respawning'
    | 'level_complete'
    | 'game_over';

declare class Game {
    constructor(config?: GameConfig);

    /** Current game state */
    readonly state: GameState;

    /** Initialize and start the game */
    start(): Promise<void>;

    /** Stop the game and clean up resources */
    stop(): void;

    /** Pause the game */
    pause(): void;

    /** Resume the game */
    resume(): void;
}

export default Game;
