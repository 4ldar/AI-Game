(function() {
const MAZE_SIZE = 17; // Odd number works best
const CELL_SIZE = 1.0;
const PLAYER_SPEED = 0.1;

// Globals
let scene, camera, renderer, clock;
let player, finish, walls = [];
let keys = {};
let mazeData = [];
let isGameWon = false;
let elapsedTime = 0;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    clock = new THREE.Clock();
    
    const worldSize = MAZE_SIZE * CELL_SIZE;
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(-worldSize/2*aspect, worldSize/2*aspect, worldSize/2, -worldSize/2, 0.1, 100);
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(light);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const playerGeo = new THREE.SphereGeometry(CELL_SIZE * 0.3, 16, 16);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    player = new THREE.Mesh(playerGeo, playerMat);
    scene.add(player);

    document.getElementById('info').innerHTML = `
        <b>Maze 2D</b><br>
        <span>[WASD] / [ARROWS] : Move</span><br>
        <span>Find the yellow exit!</span>
    `;

    resetGame();

    window.addEventListener('keydown', e => { keys[e.code] = true; });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('resize', onWindowResize);
    
    animate();
}

function resetGame() {
    isGameWon = false;
    elapsedTime = 0;
    
    generateMaze();
    buildMaze();
    
    document.getElementById('gameover').style.display = 'none';
}

function generateMaze() {
    mazeData = Array(MAZE_SIZE).fill(null).map(() => Array(MAZE_SIZE).fill(1));
    
    function carve(x, y) {
        mazeData[y][x] = 0;
        const directions = [[0, 2], [2, 0], [0, -2], [-2, 0]];
        directions.sort(() => Math.random() - 0.5);
        
        for (let [dx, dy] of directions) {
            const [nx, ny] = [x + dx, y + dy];
            if (nx > 0 && nx < MAZE_SIZE - 1 && ny > 0 && ny < MAZE_SIZE - 1 && mazeData[ny][nx] === 1) {
                mazeData[y + dy / 2][x + dx / 2] = 0;
                carve(nx, ny);
            }
        }
    }
    carve(1, 1);
    mazeData[1][0] = 0; // Entrance
    mazeData[MAZE_SIZE - 2][MAZE_SIZE - 1] = 0; // Exit
}

function buildMaze() {
    walls.forEach(w => scene.remove(w));
    walls = [];
    if(finish) scene.remove(finish);

    const wallGeo = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, CELL_SIZE);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x555588 });
    const finishMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xcccc00 });

    const offset = (MAZE_SIZE * CELL_SIZE) / 2 - CELL_SIZE / 2;

    for (let r = 0; r < MAZE_SIZE; r++) {
        for (let c = 0; c < MAZE_SIZE; c++) {
            const x = c * CELL_SIZE - offset;
            const y = -r * CELL_SIZE + offset;

            if (r === 1 && c === 0) { // Start
                player.position.set(x, y, 0);
            } else if (r === MAZE_SIZE - 2 && c === MAZE_SIZE - 1) { // Finish
                finish = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE,CELL_SIZE,CELL_SIZE), finishMat);
                finish.position.set(x, y, 0);
                scene.add(finish);
            } else if (mazeData[r][c] === 1) {
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set(x, y, 0);
                walls.push(wall);
                scene.add(wall);
            }
        }
    }
}

function updatePlayer() {
    let moveX = 0;
    let moveY = 0;
    if (keys['KeyW'] || keys['ArrowUp']) moveY = 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveY = -1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveX = -1;
    if (keys['KeyD'] || keys['ArrowRight']) moveX = 1;

    const moveVec = new THREE.Vector2(moveX, moveY).normalize().multiplyScalar(PLAYER_SPEED);
    player.position.x += moveVec.x;
    player.position.y += moveVec.y;
}

function handleCollisions() {
    const playerBox = new THREE.Box3().setFromObject(player);

    walls.forEach(wall => {
        const wallBox = new THREE.Box3().setFromObject(wall);
        if (playerBox.intersectsBox(wallBox)) {
            const overlap = playerBox.clone().intersect(wallBox);
            const overlapSize = new THREE.Vector3();
            overlap.getSize(overlapSize);

            if (overlapSize.x < overlapSize.y) {
                const sign = Math.sign(player.position.x - wall.position.x);
                player.position.x += overlapSize.x * sign;
            } else {
                const sign = Math.sign(player.position.y - wall.position.y);
                player.position.y += overlapSize.y * sign;
            }
        }
    });

    if (finish && player.position.distanceTo(finish.position) < CELL_SIZE * 0.8) {
        handleWin();
    }
}

function handleWin() {
    if (isGameWon) return;
    isGameWon = true;
    const go = document.getElementById('gameover');
    document.getElementById('end-message').textContent = 'YOU WIN!';
    document.getElementById('end-score').textContent = `Completed in ${elapsedTime.toFixed(1)} seconds!`;
    document.getElementById('restart-prompt').textContent = 'Press [ENTER] to play again';
    go.style.display = 'flex';
}

function onWindowResize() {
    const worldSize = MAZE_SIZE * CELL_SIZE;
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -worldSize/2*aspect;
    camera.right = worldSize/2*aspect;
    camera.top = worldSize/2;
    camera.bottom = -worldSize/2;
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
    
    if (isGameWon) {
        if (keys['Enter']) resetGame();
    } else {
        elapsedTime += clock.getDelta();
        updatePlayer();
        handleCollisions();
        updateHUD();
    }
    
    renderer.render(scene, camera);
}

init();
})();