(function() {
const MAZE_SIZE = 15; // Odd number works best
const CELL_SIZE = 4;
const WALL_HEIGHT = 3;
const PLAYER_SPEED = 5.0;
const PLAYER_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.5;

// Globals
let scene, camera, renderer, clock;
let player, finish, walls = [];
let keys = {};
let euler = new THREE.Euler(0, 0, 0, 'YXZ');
let mazeData = [];
let gameState = 'playing';
let elapsedTime = 0;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 1, CELL_SIZE * 5);
    clock = new THREE.Clock();
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0x404040, 1.5);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 30, 10);
    scene.add(light, dirLight);

    player = new THREE.Group();
    player.add(camera);
    player.position.y = PLAYER_HEIGHT;
    scene.add(player);
    
    const floorGeo = new THREE.PlaneGeometry(MAZE_SIZE * CELL_SIZE, MAZE_SIZE * CELL_SIZE);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    
    document.getElementById('info').innerHTML = `
        <b>3D Maze</b><br>
        <span>[CLICK] to lock mouse</span><br>
        <span>[WASD] : Move</span><br>
        <span>Mouse : Look</span>
    `;
    
    initControls();
    resetGame();
    animate();
}

function resetGame() {
    gameState = 'playing';
    elapsedTime = 0;
    walls.forEach(w => scene.remove(w));
    walls = [];
    if(finish) scene.remove(finish);
    
    generateMaze();
    buildMaze();
    
    document.getElementById('gameover').style.display = 'none';
}

function generateMaze() { 
    mazeData = Array(MAZE_SIZE).fill(null).map(() => Array(MAZE_SIZE).fill(1));
    function carve(x, y) {
        mazeData[y][x] = 0;
        const dirs = [[0, 2], [2, 0], [0, -2], [-2, 0]].sort(() => Math.random() - 0.5);
        for (let [dx, dy] of dirs) {
            const [nx, ny] = [x + dx, y + dy];
            if (nx > 0 && nx < MAZE_SIZE-1 && ny > 0 && ny < MAZE_SIZE-1 && mazeData[ny][nx] === 1) {
                mazeData[y + dy / 2][x + dx / 2] = 0;
                carve(nx, ny);
            }
        }
    }
    carve(1, 1);
    mazeData[1][0] = 0; 
    mazeData[MAZE_SIZE - 2][MAZE_SIZE - 1] = 0;
}

function buildMaze() {
    const wallGeo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x888899 });
    const finishMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xcccc00 });
    const offset = (MAZE_SIZE * CELL_SIZE) / 2 - CELL_SIZE / 2;

    for (let r = 0; r < MAZE_SIZE; r++) {
        for (let c = 0; c < MAZE_SIZE; c++) {
            const x = c * CELL_SIZE - offset;
            const z = r * CELL_SIZE - offset;
            if (r === 1 && c === 0) { // Start
                player.position.set(x, PLAYER_HEIGHT, z);
            } else if (r === MAZE_SIZE - 2 && c === MAZE_SIZE - 1) { // Finish
                finish = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE), finishMat);
                finish.position.set(x, WALL_HEIGHT / 2, z);
                scene.add(finish);
            } else if (mazeData[r][c] === 1) {
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set(x, WALL_HEIGHT / 2, z);
                walls.push(wall);
                scene.add(wall);
            }
        }
    }
}

function updatePlayer(deltaTime) {
    const moveDirection = new THREE.Vector3();
    if (keys['KeyW']) moveDirection.z = -1;
    if (keys['KeyS']) moveDirection.z = 1;
    if (keys['KeyA']) moveDirection.x = -1;
    if (keys['KeyD']) moveDirection.x = 1;
    
    moveDirection.normalize().applyQuaternion(camera.quaternion);
    moveDirection.y = 0;

    player.position.add(moveDirection.multiplyScalar(PLAYER_SPEED * deltaTime));
}

function handleCollisions() {
    const playerBox = new THREE.Box3().setFromCenterAndSize(player.position, new THREE.Vector3(PLAYER_RADIUS*2, PLAYER_HEIGHT, PLAYER_RADIUS*2));
    
    walls.forEach(wall => {
        const wallBox = new THREE.Box3().setFromObject(wall);
        if (playerBox.intersectsBox(wallBox)) {
            const overlap = playerBox.clone().intersect(wallBox);
            const overlapSize = new THREE.Vector3();
            overlap.getSize(overlapSize);
            
            if (overlapSize.x < overlapSize.z) {
                const sign = Math.sign(player.position.x - wall.position.x);
                player.position.x += overlapSize.x * sign;
            } else {
                const sign = Math.sign(player.position.z - wall.position.z);
                player.position.z += overlapSize.z * sign;
            }
        }
    });

    if (finish && player.position.distanceTo(finish.position) < CELL_SIZE) {
        handleWin();
    }
}

function handleWin() {
    if (gameState === 'game_over') return;
    gameState = 'game_over';
    const go = document.getElementById('gameover');
    go.querySelector('#end-message').textContent = 'YOU WIN!';
    go.querySelector('#end-score').textContent = `Completed in ${elapsedTime.toFixed(1)} seconds!`;
    go.querySelector('#restart-prompt').textContent = 'Press [ENTER] to play again';
    go.style.display = 'flex';
    document.exitPointerLock();
}

function initControls() {
    const dom = renderer.domElement;
    dom.addEventListener('click', () => dom.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
        document.getElementById('crosshair').style.display = document.pointerLockElement === dom ? 'block' : 'none';
    });
    document.addEventListener('mousemove', e => {
        if (document.pointerLockElement !== dom) return;
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= e.movementX * 0.002;
        euler.x -= e.movementY * 0.002;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    });
    window.addEventListener('keydown', e => { keys[e.code] = true; });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateHUD() {
    document.getElementById('timer').textContent = `Time: ${elapsedTime.toFixed(1)}s`;
    document.getElementById('score').style.display = 'none';
    document.getElementById('lives').style.display = 'none';
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    
    if (gameState === 'playing') {
        updatePlayer(deltaTime);
        handleCollisions();
        updateHUD();
    } else if (gameState === 'game_over') {
        if (keys['Enter']) resetGame();
    }
    
    renderer.render(scene, camera);
}

init();
})();