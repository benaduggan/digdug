import './styles.css';
import { Game } from './Game.js';

// Export the Game class as the default export for npm package
export default Game;

// Also export as named export
export { Game };

// Auto-initialize if running in development mode (with #game element)
if (typeof window !== 'undefined') {
    const gameContainer = document.getElementById('game');

    if (gameContainer) {
        // Development mode - auto-start the game
        const game = new Game({
            container: gameContainer,
            scale: window.devicePixelRatio,
            debug: false,
            onGameOver: (score) => {
                // console.log('Game Over! Final Score:', score);
            },
            onLevelComplete: (level) => {
                // console.log('Level', level, 'Complete!');
            },
            onScoreChange: (score) => {
                // Could update external UI here
            },
        });

        await game.start();

        // Make game accessible globally for debugging
        window.digdugGame = game;
    }
}
