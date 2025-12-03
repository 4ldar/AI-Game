(function() {
const GRAVITY = -20;
const PLAYER_SPEED = 6;
const JUMP_FORCE = 8;
const PLAYER_RADIUS = 0.5;
const LEVEL_DATA = [
    { p: [0, -0.5, 0], s: [4, 1, 4] }, { p: [6, 1, 0], s: [2, 1, 2] },
    { p: [10, 2, -2], s: [2, 1, 2] }, { p: [13, 4, 3], s: [2, 1, 2] },
    { p: [10, 5.5, 8], s: [2, 1, 2], isFinish: true },
];
const FALL_LIMIT = -20;
const CAM_OFFSET = new THREE.Vector3(0, 4, 8);

// --- GLOBALS ---
let scene, camera, renderer, world, clock;
let playerBody, playerMesh;
let platforms = [];
let keys = {}, euler = new THREE.Euler(0, 0, 0, 'YXZ');
let gameState = 'playing';

// --- INITIALIZATION ---
function init() {
    initThree();
    initCannon();
    initControls();
    buildLevel();
    resetGame();
    animate();
}

function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, 60);
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.6);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 30, 15);
    dirLight.castShadow = true;
    scene.add(light, dirLight);

    const playerGeo = new THREE.BoxGeometry(PLAYER_RADIUS * 2, 2, PLAYER_RADIUS * 2);
    const playerMat = new THREE.MeshStandardMaterial({color: 0x00ff00});
    playerMesh = new THREE.Mesh(playerGeo, playerMat);
    playerMesh.castShadow = true;
    scene.add(playerMesh);

    document.getElementById('info').innerHTML = `
        <b>Third-Person Parkour</b><br>
        <span>[WASD] : Move | [SPACE] : Jump | [R] : Reset</span>
    `;
}

function initCannon() {
    world = new CANNON.World();
    world.gravity.set(0, GRAVITY, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    
    const playerShape = new CANNON.Sphere(PLAYER_RADIUS);
    playerBody = new CANNON.Body({ mass: 5, shape: playerShape, linearDamping: 0.8 });
    world.addBody(playerBody);
}

function buildLevel() {
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
    world.addBody(groundBody);
    
    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(100,100), new THREE.MeshStandardMaterial({color: 0x4a5d23}));
    groundMesh.rotation.x = -Math.PI/2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    LEVEL_DATA.forEach(data => {
        const [px, py, pz] = data.p;
        const [sx, sy, sz] = data.s;
        
        const mat = new THREE.MeshStandardMaterial({ color: data.isFinish ? 0xffd700 : 0x8b4513 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
        mesh.position.set(px, py, pz);
        mesh.castShadow = mesh.receiveShadow = true;
        scene.add(mesh);
        
        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(sx/2, sy/2, sz/2)) });
        body.position.set(px, py, pz);
        world.addBody(body);
        
        platforms.push({ mesh, body, isFinish: !!data.isFinish });
    });
}

function resetGame() {
    gameState = 'playing';
    clock.start();
    playerBody.position.set(0, 5, 0);
    playerBody.velocity.set(0, 0, 0);
    document.getElementById('gameover').style.display = 'none';
}

// --- GAME LOOP & LOGIC ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    if (gameState === 'playing') {
        world.step(1/60, deltaTime);
        
        updatePlayer();
        updateCamera();
        checkGameState();
        
        playerMesh.position.copy(playerBody.position);
    } else if(keys['KeyR']) {
        resetGame();
    }
    
    document.getElementById('timer').textContent = `Time: ${clock.elapsedTime.toFixed(1)}s`;
    document.getElementById('score').style.display = 'none';
    document.getElementById('lives').style.display = 'none';
    renderer.render(scene, camera);
}

function updatePlayer() {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), forward).normalize();
    
    let moveVel = new THREE.Vector3();
    if (keys['KeyW']) moveVel.add(forward);
    if (keys['KeyS']) moveVel.sub(forward);
    if (keys['KeyA']) moveVel.add(right);
    if (keys['KeyD']) moveVel.sub(right);
    
    if(moveVel.lengthSq() > 0) {
        moveVel.normalize().multiplyScalar(PLAYER_SPEED);
        playerBody.velocity.x = moveVel.x;
        playerBody.velocity.z = moveVel.z;
        // Rotate mesh to face movement direction
        const targetRotation = Math.atan2(moveVel.x, moveVel.z);
        playerMesh.rotation.y += (targetRotation - playerMesh.rotation.y) * 0.2;
    }
    
    if (keys['Space'] && isPlayerOnGround()) {
        playerBody.velocity.y = JUMP_FORCE;
    }
}

function updateCamera() {
    const targetPos = playerBody.position.clone().add(CAM_OFFSET);
    camera.position.lerp(targetPos, 0.1);
    camera.lookAt(playerBody.position);
}

function isPlayerOnGround() {
    const from = playerBody.position;
    const to = new CANNON.Vec3(from.x, from.y - PLAYER_RADIUS - 0.1, from.z);
    return world.raycastClosest(from, to, {}, new CANNON.RaycastResult());
}

function checkGameState() {
    if (playerBody.position.y < FALL_LIMIT) handleEndGame(false);
    platforms.forEach(p => {
        if (p.isFinish && playerBody.position.distanceTo(p.body.position) < 2) {
            handleEndGame(true);
        }
    });
}

function handleEndGame(isWin) {
    if (gameState !== 'playing') return;
    gameState = isWin ? 'won' : 'lost';
    const go = document.getElementById('gameover');
    go.querySelector('#end-message').textContent = isWin ? "YOU WIN!" : "YOU FELL";
    go.querySelector('#restart-prompt').textContent = 'Press [R] to restart';
    go.style.display = 'flex';
}

// --- CONTROLS & RESIZE ---
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

init();
})();