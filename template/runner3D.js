(function() {
// === Runner 3D (Side-scrolling, Refactored) ===

// Settings
const GRAVITY = -0.04;
const JUMP_FORCE = 1.0;
const PLAYER_HORIZONTAL_SPEED = 0.2;
const TRACK_WIDTH = 8;
const INITIAL_GAME_SPEED = 0.15;
const SPEED_ACCEL = 0.0001;
const OBSTACLE_SPAWN_RATE = 0.015;

// Globals
let scene, camera, renderer, clock;
let player, ground;
let obstacles = [];
let keys = {};
let score, gameSpeed;
let gameState = 'playing';

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 15, 50);
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(-5, 5, 10);
    camera.lookAt(5, 0, 0);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.6);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 0);
    dirLight.castShadow = true;
    scene.add(light, dirLight);

    const playerGeo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.castShadow = true;
    player.userData = { velocity: new THREE.Vector3(), isOnGround: true };
    scene.add(player);
    
    const groundGeo = new THREE.PlaneGeometry(50, TRACK_WIDTH + 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a5d23 });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    document.getElementById('info').innerHTML = `
        <b>Side-Runner 3D</b><br>
        <span>[A][D] : Move Left/Right</span><br>
        <span>[SPACE] : Jump</span>
    `;

    resetGame();
    initControls();
    animate();
}

function resetGame() {
    gameState = 'playing';
    score = 0;
    gameSpeed = INITIAL_GAME_SPEED;
    
    player.position.set(0, 0.5, 0);
    player.userData.velocity.set(0,0,0);
    player.userData.isOnGround = true;
    
    obstacles.forEach(obj => scene.remove(obj));
    obstacles = [];
    
    document.getElementById('gameover').style.display = 'none';
}

function spawnObstacle() {
    if (Math.random() > OBSTACLE_SPAWN_RATE) return;

    const height = 1 + Math.random();
    const geo = new THREE.BoxGeometry(1, height, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const obstacle = new THREE.Mesh(geo, mat);
    
    obstacle.position.set(
        20,
        height / 2,
        (Math.random() - 0.5) * TRACK_WIDTH
    );
    obstacle.castShadow = true;
    obstacles.push(obstacle);
    scene.add(obstacle);
}

function updatePlayer() {
    // Horizontal (Z-axis) movement
    let targetZ = player.position.z;
    if (keys['KeyA'] || keys['ArrowLeft']) targetZ -= PLAYER_HORIZONTAL_SPEED;
    if (keys['KeyD'] || keys['ArrowRight']) targetZ += PLAYER_HORIZONTAL_SPEED;
    player.position.z = THREE.MathUtils.clamp(targetZ, -TRACK_WIDTH / 2, TRACK_WIDTH / 2);
    
    // Gravity & Jump
    player.userData.velocity.y += GRAVITY;
    player.position.y += player.userData.velocity.y;

    if (player.position.y <= 0.5) {
        player.position.y = 0.5;
        player.userData.velocity.y = 0;
        player.userData.isOnGround = true;
    }

    if ((keys['KeyW'] || keys['Space']) && player.userData.isOnGround) {
        player.userData.velocity.y = JUMP_FORCE * 0.15;
        player.userData.isOnGround = false;
    }
}

function updateWorld() {
    gameSpeed += SPEED_ACCEL;
    score = Math.floor(score + gameSpeed);

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.position.x -= gameSpeed;

        if (obstacle.position.x < -20) {
            scene.remove(obstacles.splice(i, 1)[0]);
        }
    }
}

function handleCollisions() {
    const playerBox = new THREE.Box3().setFromObject(player);
    for (const obstacle of obstacles) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacle);
        if (playerBox.intersectsBox(obstacleBox)) {
            handleEndGame();
            return;
        }
    }
}

function handleEndGame() {
    gameState = 'game_over';
    const go = document.getElementById('gameover');
    go.querySelector('#end-message').textContent = 'GAME OVER';
    go.querySelector('#end-score').textContent = `Score: ${score}`;
    go.querySelector('#restart-prompt').textContent = 'Press [R] to restart';
    go.style.display = 'flex';
}

function initControls() {
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
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('lives').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('phase').style.display = 'none';
    document.getElementById('pong-score').style.display = 'none';
    document.getElementById('crosshair').style.display = 'none';
    if(document.getElementById('race3d-ui')) document.getElementById('race3d-ui').style.display = 'none';
    document.getElementById('message').style.display = 'none';
    document.getElementById('countdown').style.display = 'none';
}

function animate() {
    requestAnimationFrame(animate);

    if (gameState === 'playing') {
        updatePlayer();
        spawnObstacle();
        updateWorld();
        handleCollisions();
        updateHUD();
    } else if (keys['KeyR']) {
        resetGame();
    }
    
    renderer.render(scene, camera);
}

init();
})();
