(function() {
// === Collector 2D Game (Refactored) ===

// Settings
const WORLD_W = 22;
const WORLD_H = 16;
const PLAYER_SPEED = 0.2;
const ITEM_COUNT = 15;
const TIME_LIMIT = 45; // seconds

// Globals
let scene, camera, renderer, clock;
let player, items = [];
let keys = {};
let score, timeLeft;
let isGameOver = false;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2d1b4e);
    clock = new THREE.Clock();

    const gameCanvasContainer = document.getElementById('game-canvas-container');
    const aspectRatio = gameCanvasContainer.offsetWidth / gameCanvasContainer.offsetHeight;

    camera = new THREE.OrthographicCamera(
        -WORLD_W / 2 * aspectRatio, WORLD_W / 2 * aspectRatio,
        WORLD_H / 2, -WORLD_H / 2,
        0.1, 100
    );
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(gameCanvasContainer.offsetWidth, gameCanvasContainer.offsetHeight);
    gameCanvasContainer.appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(light);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const playerGeo = new THREE.CircleGeometry(0.5, 32);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    player = new THREE.Mesh(playerGeo, playerMat);
    scene.add(player);
    
    buildWalls();
    resetGame();

    // Set up info text
    const infoDiv = document.getElementById('info');
    infoDiv.innerHTML = `
        <b>Collector 2D</b><br>
        <span>[WASD] / [ARROWS] : Move</span><br>
        <span>Collect all items before time runs out!</span>
    `;

    window.addEventListener('keydown', e => { keys[e.code] = true; });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('resize', onWindowResize);
    
    animate();
}

function resetGame() {
    isGameOver = false;
    score = 0;
    timeLeft = TIME_LIMIT;

    player.position.set(0, 0, 0);

    items.forEach(i => scene.remove(i));
    items = [];
    spawnItems(ITEM_COUNT);
    
    updateHUD();
    document.getElementById('gameover').style.display = 'none';

    // Make sure other non-relevant UIs are hidden
    document.getElementById('crosshair').style.display = 'none';
    document.getElementById('message').style.display = 'none';
    document.getElementById('countdown').style.display = 'none';
    document.getElementById('wave-announcement').style.display = 'none';
    document.getElementById('pong-score').style.display = 'none';
    if(document.getElementById('race3d-ui')) document.getElementById('race3d-ui').style.display = 'none';
    document.getElementById('tower-panel').style.display = 'none';
    document.getElementById('start-wave-btn').style.display = 'none';
}

function spawnItems(count) {
    const geo = new THREE.IcosahedronGeometry(0.4, 0);
    for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6) });
        const item = new THREE.Mesh(geo, mat);
        
        item.position.set(
            (Math.random() - 0.5) * (WORLD_W - 2),
            (Math.random() - 0.5) * (WORLD_H - 2),
            0
        );
        items.push(item);
        scene.add(item);
    }
}

function updatePlayer() {
    if (keys['KeyW'] || keys['ArrowUp']) player.position.y += PLAYER_SPEED;
    if (keys['KeyS'] || keys['ArrowDown']) player.position.y -= PLAYER_SPEED;
    if (keys['KeyA'] || keys['ArrowLeft']) player.position.x -= PLAYER_SPEED;
    if (keys['KeyD'] || keys['ArrowRight']) player.position.x += PLAYER_SPEED;
    
    // Clamp to world boundaries
    const halfW = WORLD_W / 2 - 0.5;
    const halfH = WORLD_H / 2 - 0.5;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -halfW, halfW);
    player.position.y = THREE.MathUtils.clamp(player.position.y, -halfH, halfH);
}

function updateGame(deltaTime) {
    timeLeft -= deltaTime;
    if (timeLeft <= 0) {
        timeLeft = 0;
        handleEndGame(false);
    }
    
    items.forEach(item => {
        item.rotation.x += 0.5 * deltaTime;
        item.rotation.y += 0.5 * deltaTime;
    });
}

function handleCollisions() {
    for (let i = items.length - 1; i >= 0; i--) {
        if (player.position.distanceTo(items[i].position) < 0.8) {
            scene.remove(items[i]);
            items.splice(i, 1);
            score++;
            if (score >= ITEM_COUNT) {
                handleEndGame(true);
            }
        }
    }
}

function handleEndGame(isWin) {
    if (isGameOver) return;
    isGameOver = true;
    
    const go = document.getElementById('gameover');
    const timeTaken = TIME_LIMIT - timeLeft;
    
    document.getElementById('end-message').textContent = isWin ? "YOU WIN!" : "TIME'S UP!";
    document.getElementById('end-score').textContent = 'You collected ' + score + ' / ' + ITEM_COUNT + ' items';
    if(isWin) {
         document.getElementById('end-score').textContent += ' in ' + timeTaken.toFixed(1) + ' seconds.';
    }
    document.getElementById('restart-prompt').textContent = 'Press [ENTER] to restart';
    
    go.style.display = 'flex';
    go.style.alignItems = 'center';
    go.style.justifyContent = 'center';
}

function buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({color: 0x4a4a6e});
    const T = 0.5; // thickness
    const top = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, T, T), wallMat);
    top.position.set(0, WORLD_H / 2, 0);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, T, T), wallMat);
    bottom.position.set(0, -WORLD_H / 2, 0);
    const left = new THREE.Mesh(new THREE.BoxGeometry(T, WORLD_H, T), wallMat);
    left.position.set(-WORLD_W / 2, 0, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(T, WORLD_H, T), wallMat);
    right.position.set(WORLD_W / 2, 0, 0);
    scene.add(top, bottom, left, right);
}

function onWindowResize() {
    const gameCanvasContainer = document.getElementById('game-canvas-container');
    const newWidth = gameCanvasContainer.offsetWidth;
    const newHeight = gameCanvasContainer.offsetHeight;

    renderer.setSize(newWidth, newHeight);

    const aspectRatio = newWidth / newHeight;
    camera.left = -WORLD_W / 2 * aspectRatio;
    camera.right = WORLD_W / 2 * aspectRatio;
    camera.top = WORLD_H / 2;
    camera.bottom = -WORLD_H / 2;
    camera.updateProjectionMatrix();
}

function updateHUD() {
    document.getElementById('score').textContent = 'Items: ' + score + ' / ' + ITEM_COUNT;
    document.getElementById('timer').textContent = 'Time: ' + Math.ceil(timeLeft);
    
    // Hide unused stats specific to other games, and show this game's relevant stats
    document.getElementById('score').style.display = 'inline'; // Ensure score is visible
    document.getElementById('timer').style.display = 'inline'; // Ensure timer is visible
    document.getElementById('lives').style.display = 'none';
    document.getElementById('phase').style.display = 'none';
    if(document.getElementById('health')) document.getElementById('health').style.display = 'none';
    if(document.getElementById('wave')) document.getElementById('wave').style.display = 'none';

    // Also clear content of other specific HUDs and hide them
    document.getElementById('pong-score').style.display = 'none';
    document.getElementById('pong-score').textContent = '';
    document.getElementById('crosshair').style.display = 'none';
    if(document.getElementById('race3d-ui')) document.getElementById('race3d-ui').style.display = 'none';
    document.getElementById('message').style.display = 'none';
    document.getElementById('countdown').style.display = 'none';
    document.getElementById('wave-announcement').style.display = 'none';
    document.getElementById('tower-panel').style.display = 'none';
    document.getElementById('start-wave-btn').style.display = 'none';


    // Specific HUD for Collector
    document.getElementById('game-stats').innerHTML = `
        <span id="score">Items: ${score} / ${ITEM_COUNT}</span><br>
        <span id="timer">Time: ${Math.ceil(timeLeft)}</span>
    `;
    document.getElementById('game-stats').style.display = 'block'; // Make game-stats visible
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    if (isGameOver) {
        if(keys['Enter']) resetGame();
    } else {
        updatePlayer();
        updateGame(deltaTime);
        handleCollisions();
        updateHUD();
    }
    renderer.render(scene, camera);
}

init();
})();