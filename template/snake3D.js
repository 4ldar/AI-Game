(function() {
// === Snake 3D (Refactored) ===

// Settings
const GRID_SIZE = 14; // Bounded box is from -7 to 7
const GAME_SPEED = 150; // ms per step

// Globals
let scene, camera, renderer, clock;
let snake, food;
let direction, nextDirection;
let keys = {};
let score, lastStepTime;
let gameState = 'playing';

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171e30);
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0x808080);
    const pLight = new THREE.PointLight(0xffffff, 1, 100);
    pLight.position.set(0, 10, 0);
    scene.add(light, pLight);

    const cageGeo = new THREE.BoxGeometry(GRID_SIZE, GRID_SIZE, GRID_SIZE);
    const cageMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.2 });
    const cage = new THREE.Mesh(cageGeo, cageMat);
    scene.add(cage);

    document.getElementById('info').innerHTML = `
        <b>3D Snake</b><br>
        <span>[WASD] : Move on XY plane</span><br>
        <span>[Q][E] : Move Up/Down</span>
    `;

    initControls();
    resetGame();
    animate();
}

function resetGame() {
    gameState = 'playing';
    score = 0;
    lastStepTime = 0;
    
    snake?.forEach(s => scene.remove(s));
    snake = [];
    
    if(food) scene.remove(food);
    food = null;

    direction = new THREE.Vector3(1, 0, 0);
    nextDirection = new THREE.Vector3(1, 0, 0);

    const startPos = new THREE.Vector3(-2, 0, 0);
    for (let i = 0; i < 3; i++) {
        const pos = startPos.clone().sub(direction.clone().multiplyScalar(i));
        const segment = createSegment(pos);
        snake.push(segment);
    }
    
    spawnFood();
    updateHUD();
    document.getElementById('gameover').style.display = 'none';
}

function createSegment(pos) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    return mesh;
}

function spawnFood() {
    if (food) scene.remove(food);
    
    let pos = new THREE.Vector3();
    let validPosition = false;
    const halfGrid = GRID_SIZE / 2 - 1;
    
    while (!validPosition) {
        pos.set(
            THREE.MathUtils.randInt(-halfGrid, halfGrid),
            THREE.MathUtils.randInt(-halfGrid, halfGrid),
            THREE.MathUtils.randInt(-halfGrid, halfGrid)
        );
        validPosition = !snake.some(s => s.position.equals(pos));
    }
    
    const geo = new THREE.SphereGeometry(0.5, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0x441111 });
    food = new THREE.Mesh(geo, mat);
    food.position.copy(pos);
    scene.add(food);
}

function updateGame() {
    if (!direction.equals(nextDirection) && !direction.equals(nextDirection.clone().negate())) {
        direction.copy(nextDirection);
    }

    const newHeadPos = snake[0].position.clone().add(direction);
    
    // Collision Checks
    const halfGrid = GRID_SIZE / 2;
    if (Math.abs(newHeadPos.x) >= halfGrid || Math.abs(newHeadPos.y) >= halfGrid || Math.abs(newHeadPos.z) >= halfGrid) {
        handleEndGame(); return;
    }
    if (snake.some(s => s.position.equals(newHeadPos))) {
        handleEndGame(); return;
    }

    // Food collision
    const ateFood = newHeadPos.equals(food.position);
    if (ateFood) {
        score += 10;
        spawnFood();
    } else {
        const tail = snake.pop();
        scene.remove(tail);
    }
    
    const newHead = createSegment(newHeadPos);
    newHead.material.color.setHex(0x33ff33); // Head color
    snake[0].material.color.setHex(0x00ff00); // Old head
    snake.unshift(newHead);
}

function handleInput() {
    if (keys['KeyW']) nextDirection.set(0, 0, -1);
    if (keys['KeyS']) nextDirection.set(0, 0, 1);
    if (keys['KeyA']) nextDirection.set(-1, 0, 0);
    if (keys['KeyD']) nextDirection.set(1, 0, 0);
    if (keys['KeyQ']) nextDirection.set(0, 1, 0);
    if (keys['KeyE']) nextDirection.set(0, -1, 0);
}

function handleEndGame() {
    gameState = 'game_over';
    const go = document.getElementById('gameover');
    go.querySelector('#end-message').textContent = 'GAME OVER';
    go.querySelector('#end-score').textContent = `Final Score: ${score}`;
    go.querySelector('#restart-prompt').textContent = 'Press [R] to restart';
    go.style.display = 'flex';
}

function updateCamera(time) {
    const dist = 18;
    camera.position.set(
        Math.sin(time * 0.1) * dist,
        10,
        Math.cos(time * 0.1) * dist
    );
    camera.lookAt(0,0,0);
}

function initControls() {
    window.addEventListener('keydown', e => { keys[e.code] = true; handleInput(); });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateHUD() {
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('lives').style.display = 'none'; // Hide lives for this game
    document.getElementById('timer').style.display = 'none'; // Hide timer for this game
    document.getElementById('phase').style.display = 'none'; // Hide phase for this game
    document.getElementById('pong-score').style.display = 'none'; // Hide pong-score for this game
    document.getElementById('health').style.display = 'none'; // Hide health for this game
    if(document.getElementById('race3d-ui')) document.getElementById('race3d-ui').style.display = 'none'; // Hide race3d-ui for this game
    document.getElementById('message').style.display = 'none'; // Hide message for this game
    document.getElementById('countdown').style.display = 'none'; // Hide countdown for this game

    // Specific HUD for Snake
    document.getElementById('game-stats').innerHTML = `
        <span id="score">Score: ${score}</span>
    `;
}

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    if (gameState === 'playing' && elapsedTime > lastStepTime + (GAME_SPEED/1000)) {
        lastStepTime = elapsedTime;
        updateGame();
        updateHUD();
    } else if (gameState === 'game_over') {
        if(keys['KeyR']) resetGame();
    }
    
    updateCamera(elapsedTime);
    renderer.render(scene, camera);
}

init();
})();
