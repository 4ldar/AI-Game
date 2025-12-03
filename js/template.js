import { collector2D } from '../template/collector2D.js';

document.addEventListener('DOMContentLoaded', function() {
    const gameContainer = document.getElementById('game-canvas-container');
    
    if (gameContainer) {
        const iframe = document.createElement('iframe');
        iframe.srcdoc = collector2D;
        gameContainer.appendChild(iframe);
    } else {
        console.error('The game canvas container was not found in the document.');
    }
});
