import { Game } from './Game.js';

export default Game;

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    const gameContainer = document.getElementById('game');

    if (gameContainer) {
        // Development mode - auto-start the game
        const game = new Game({
            container: gameContainer,
            debug: false,
            // onGameOver: (score) => {
            //     console.log('Game Over! Final Score:', score);
            // },
            // onLevelComplete: (level) => {
            //     console.log('Level', level, 'Complete!');
            // },
            // onScoreChange: (score) => {
            //     console.log('Score changed:', score);
            // },
        });
        game.start();
        window.digdugGame = game;
    }
}
