(function() {
// === Snake 2D Game (Refactored) ===

// Game Settings
const GRID_SIZE = 22;
const CELL_SIZE = 0.8;
const GAME_SPEED = 120; // ms per step

// Globals
let scene, camera, renderer;
let snake, food;
let direction, nextDirection;
let keys = {};
let score;
let isGameOver = false;
let lastStepTime = 0;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    const aspect = window.innerWidth / window.innerHeight;
    const worldH = GRID_SIZE * CELL_SIZE;
    const worldW = worldH * aspect;
    camera = new THREE.OrthographicCamera(-worldW / 2, worldW / 2, worldH / 2, -worldH / 2, 0.1, 100);
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(light);
    
    buildWalls();
    resetGame();

    document.getElementById('info').innerHTML = `
        <b>Snake 2D</b><br>
        <span>[ARROWS] / [WASD] : Move</span>
    `;

    document.getElementById('restart-btn').addEventListener('click', resetGame);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onWindowResize);

    animate();
}

function resetGame() {
    isGameOver = false;
    score = 0;
    direction = new THREE.Vector2(1, 0);
    nextDirection = new THREE.Vector2(1, 0);
    
    if (snake) snake.forEach(s => scene.remove(s));
    snake = [];
    
    if(food) scene.remove(food);
    food = null;

    // Create initial snake
    const startX = -Math.floor(GRID_SIZE / 4);
    for (let i = 0; i < 3; i++) {
        const segment = createSegment(new THREE.Vector2(startX - i, 0));
        snake.push(segment);
    }
    
    spawnFood();
    updateHUD();
    document.getElementById('gameover').style.display = 'none';
}

function createSegment(pos, isHead = false) {
    const geo = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, CELL_SIZE * 0.8);
    const mat = new THREE.MeshStandardMaterial({ 
        color: isHead ? 0x33dd33 : 0x00ff00,
        roughness: 0.4
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x * CELL_SIZE, pos.y * CELL_SIZE, 0);
    mesh.userData.gridPosition = pos;
    scene.add(mesh);
    return mesh;
}

function spawnFood() {
    if (food) scene.remove(food);
    
    let pos;
    let validPosition = false;
    const halfGrid = Math.floor(GRID_SIZE / 2);
    
    while (!validPosition) {
        pos = new THREE.Vector2(
            THREE.MathUtils.randInt(-halfGrid, halfGrid - 1),
            THREE.MathUtils.randInt(-halfGrid, halfGrid - 1)
        );
        validPosition = !snake.some(s => s.userData.gridPosition.equals(pos));
    }
    
    const geo = new THREE.SphereGeometry(CELL_SIZE / 2.5, 12, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.2 });
    food = new THREE.Mesh(geo, mat);
    food.position.set(pos.x * CELL_SIZE, pos.y * CELL_SIZE, 0);
    food.userData.gridPosition = pos;
    scene.add(food);
}

function updateGame() {
    if (isGameOver) return;
    
    direction.copy(nextDirection);
    const headPos = snake[0].userData.gridPosition.clone();
    const newHeadPos = headPos.add(direction);

    // Collision checks
    if (checkWallCollision(newHeadPos) || checkSelfCollision(newHeadPos)) {
        handleGameOver(checkWallCollision(newHeadPos) ? "You hit the wall!" : "You hit yourself!");
        return;
    }

    const ateFood = newHeadPos.equals(food.userData.gridPosition);

    // Add new head
    const newHead = createSegment(newHeadPos, true);
    snake.unshift(newHead);
    snake[1].material.color.setHex(0x00ff00); // Old head becomes body

    if (ateFood) {
        score += 10;
        spawnFood();
    } else {
        const tail = snake.pop();
        scene.remove(tail);
    }
    
    updateHUD();
}

function checkWallCollision(pos) {
    const halfGrid = GRID_SIZE / 2;
    return pos.x >= halfGrid || pos.x < -halfGrid || pos.y >= halfGrid || pos.y < -halfGrid;
}

function checkSelfCollision(pos) {
    // Check against all but the last segment (which will move)
    return snake.slice(0, -1).some(s => s.userData.gridPosition.equals(pos));
}

function handleGameOver(reason) {
    isGameOver = true;
    const go = document.getElementById('gameover');
    document.getElementById('end-message').textContent = "GAME OVER";
    document.getElementById('end-reason').textContent = reason;
    document.getElementById('end-score').textContent = `Final Score: ${score}`;
    document.getElementById('restart-prompt').textContent = ''; // Hide generic restart prompt
    go.style.display = 'flex';
    go.style.alignItems = 'center';
    go.style.justifyContent = 'center';
}

function onKeyDown(e) {
    if (isGameOver) {
        if (e.code === 'Enter' || e.code === 'Space') resetGame();
        return;
    }
    if ((e.code === 'ArrowUp' || e.code === 'KeyW') && direction.y === 0) nextDirection.set(0, 1);
    if ((e.code === 'ArrowDown' || e.code === 'KeyS') && direction.y === 0) nextDirection.set(0, -1);
    if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && direction.x === 0) nextDirection.set(-1, 0);
    if ((e.code === 'ArrowRight' || e.code === 'KeyD') && direction.x === 0) nextDirection.set(1, 0);
}

function buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({color: 0x3a3a5e, roughness: 0.8});
    const halfSize = GRID_SIZE * CELL_SIZE / 2;
    const thickness = CELL_SIZE;
    
    const top = new THREE.Mesh(new THREE.BoxGeometry(GRID_SIZE*CELL_SIZE + thickness, thickness, thickness), wallMat);
    top.position.set(0, halfSize, 0);
    scene.add(top);

    const bottom = new THREE.Mesh(new THREE.BoxGeometry(GRID_SIZE*CELL_SIZE + thickness, thickness, thickness), wallMat);
    bottom.position.set(0, -halfSize, 0);
    scene.add(bottom);
    
    const left = new THREE.Mesh(new THREE.BoxGeometry(thickness, GRID_SIZE*CELL_SIZE, thickness), wallMat);
    left.position.set(-halfSize, 0, 0);
    scene.add(left);
    
    const right = new THREE.Mesh(new THREE.BoxGeometry(thickness, GRID_SIZE*CELL_SIZE, thickness), wallMat);
    right.position.set(halfSize, 0, 0);
    scene.add(right);
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const worldH = GRID_SIZE * CELL_SIZE;
    const worldW = worldH * aspect;
    camera.left = -worldW / 2;
    camera.right = worldW / 2;
    camera.top = worldH / 2;
    camera.bottom = -worldH / 2;
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

function animate(timestamp) {
    requestAnimationFrame(animate);

    if (!isGameOver && timestamp - lastStepTime > GAME_SPEED) {
        lastStepTime = timestamp;
        updateGame();
    }
    
    renderer.render(scene, camera);
}

init();
})();
