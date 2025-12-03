(function() {
// === Endless Runner 3D (Refactored) ===

// Settings
const GRAVITY = -0.08;
const JUMP_FORCE = 1.2;
const LANE_WIDTH = 3;
const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];
const INITIAL_SPEED = 0.2;
const SPEED_ACCEL = 0.0001;
const SEGMENT_LENGTH = 20;
const VISIBLE_SEGMENTS = 5;

// Globals
let scene, camera, renderer, clock;
let player;
let track = [], obstacles = [];
let keys = {};
let score, gameSpeed;
let gameState = 'playing';

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, 80);
    clock = new THREE.Clock();

    const gameCanvasContainer = document.getElementById('game-canvas-container');
    const aspectRatio = gameCanvasContainer.offsetWidth / gameCanvasContainer.offsetHeight;

    camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 100);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(gameCanvasContainer.offsetWidth, gameCanvasContainer.offsetHeight);
    renderer.shadowMap.enabled = true;
    gameCanvasContainer.appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.6);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 0);
    dirLight.castShadow = true;
    scene.add(light, dirLight);

    const playerGeo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.castShadow = true;
    player.userData = {
        velocity: new THREE.Vector3(),
        targetLane: 1,
        isOnGround: true
    };
    scene.add(player);

    document.getElementById('info').innerHTML = `
        <b>Endless Runner</b><br>
        <span>[A][D] : Switch Lanes</span><br>
        <span>[SPACE] : Jump</span>
    `;

    resetGame();
    initControls();
    animate();
}

function resetGame() {
    gameState = 'playing';
    score = 0;
    gameSpeed = INITIAL_SPEED;
    
    player.userData.targetLane = 1;
    player.position.set(LANES[1], 0.5, 0);
    player.userData.velocity.set(0,0,0);
    
    [...track, ...obstacles].forEach(obj => scene.remove(obj));
    track = [];
    obstacles = [];

    for (let i = 0; i < VISIBLE_SEGMENTS; i++) {
        addTrackSegment(i);
    }
    
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

function addTrackSegment(index) {
    const segmentZ = index * SEGMENT_LENGTH;
    const geo = new THREE.PlaneGeometry(LANE_WIDTH * 3 + 2, SEGMENT_LENGTH);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a5d23 });
    const segment = new THREE.Mesh(geo, mat);
    segment.rotation.x = -Math.PI / 2;
    segment.position.set(0, 0, segmentZ);
    segment.receiveShadow = true;
    segment.userData.index = index;
    track.push(segment);
    scene.add(segment);
    
    if (index > 1 && Math.random() > 0.3) {
        spawnObstacle(segmentZ);
    }
}

function spawnObstacle(z) {
    const lane = Math.floor(Math.random() * 3);
    const geo = new THREE.BoxGeometry(LANE_WIDTH * 0.8, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const obstacle = new THREE.Mesh(geo, mat);
    obstacle.position.set(LANES[lane], 0.5, z + Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH/2);
    obstacle.castShadow = true;
    obstacles.push(obstacle);
    scene.add(obstacle);
}

function updatePlayer() {
    const targetX = LANES[player.userData.targetLane];
    player.position.x += (targetX - player.position.x) * 0.1;
    
    player.userData.velocity.y += GRAVITY;
    player.position.y += player.userData.velocity.y;

    if (player.position.y <= 0.5) {
        player.position.y = 0.5;
        player.userData.velocity.y = 0;
        player.userData.isOnGround = true;
    }

    if (keys['Space'] && player.userData.isOnGround) {
        player.userData.velocity.y = JUMP_FORCE * 0.1;
        player.userData.isOnGround = false;
    }
    
    player.position.z += gameSpeed;
    gameSpeed += SPEED_ACCEL;
    score = Math.floor(player.position.z);
}

function updateWorld() {
    const playerSegmentIndex = Math.floor(player.position.z / SEGMENT_LENGTH);

    for(let i = track.length - 1; i >= 0; i--) {
        if (track[i].userData.index < playerSegmentIndex - 1) {
            const oldSegment = track.splice(i, 1)[0];
            const newIndex = oldSegment.userData.index + VISIBLE_SEGMENTS;
            oldSegment.userData.index = newIndex;
            oldSegment.position.z = newIndex * SEGMENT_LENGTH;
            track.push(oldSegment);
            if(Math.random() > 0.2) spawnObstacle(oldSegment.position.z);
        }
    }
    
    for(let i = obstacles.length - 1; i >= 0; i--) {
        if(obstacles[i].position.z < player.position.z - SEGMENT_LENGTH) {
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

function updateCamera() {
    const targetPos = new THREE.Vector3(player.position.x, player.position.y + 5, player.position.z - 8);
    camera.position.lerp(targetPos, 0.1);
    camera.lookAt(player.position);
}

function handleEndGame() {
    gameState = 'game_over';
    const go = document.getElementById('gameover');
    go.querySelector('#end-message').textContent = `GAME OVER`;
    go.querySelector('#end-score').textContent = `Score: ${score}`;
    go.querySelector('#restart-prompt').textContent = `Press [R] to restart`;
    go.style.display = 'flex';
}

function initControls() {
    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        if(gameState === 'playing') {
             if (e.code === 'KeyA' && player.userData.targetLane > 0) player.userData.targetLane--;
             if (e.code === 'KeyD' && player.userData.targetLane < 2) player.userData.targetLane++;
        }
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    const gameCanvasContainer = document.getElementById('game-canvas-container');
    const newWidth = gameCanvasContainer.offsetWidth;
    const newHeight = gameCanvasContainer.offsetHeight;

    renderer.setSize(newWidth, newHeight);

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
}

function updateHUD() {
    document.getElementById('score').textContent = `Score: ${score}`;

    // Hide unused stats specific to other games, and show this game's relevant stats
    document.getElementById('score').style.display = 'inline'; // Ensure score is visible
    document.getElementById('lives').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
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

    // If the game has a specific game-stats structure
    document.getElementById('game-stats').innerHTML = `
        <span id="score">Score: ${score}</span>
    `;
    document.getElementById('game-stats').style.display = 'block'; // Make game-stats visible
}

function animate() {
    requestAnimationFrame(animate);

    if (gameState === 'playing') {
        updatePlayer();
        updateWorld();
        handleCollisions();
        updateCamera();
        updateHUD(); // Call updateHUD here
    } else if (keys['KeyR']) {
        resetGame();
    }
    
    renderer.render(scene, camera);
}

init();
})();