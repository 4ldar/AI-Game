(function() {
// === 3D Survival Arena (Refactored w/ Cannon.js) ===

// --- SETTINGS ---
const ARENA_SIZE = 30;
const PLAYER_SPEED = 8, PLAYER_HP = 100;
const FIRE_RATE = 200, BULLET_SPEED = 50, BULLET_DMG = 20;
const ENEMY_SPEED = 3, ENEMY_HP = 50, ENEMY_DMG = 10;

// --- GLOBALS ---
let scene, camera, renderer, world, clock;
let player = {}, enemies = [], bullets = [];
let keys = {}, mouse = new THREE.Vector2();
let gameState = 'between_waves';
let score, wave;

// --- INITIALIZATION ---
function init() {
    initThree();
    initCannon();
    initControls();
    buildArena();
    
    const playerMat = new THREE.MeshStandardMaterial({color: 0x00ff00});
    player.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), playerMat);
    player.mesh.castShadow = true;
    scene.add(player.mesh);

    const playerShape = new CANNON.Sphere(0.75);
    player.body = new CANNON.Body({ mass: 10, shape: playerShape, linearDamping: 0.9 });
    world.addBody(player.body);

    document.getElementById('info').innerHTML = `
        <b>Arena Survival</b><br>
        <span>[WASD] : Move</span><br>
        <span>Mouse : Aim & Shoot</span>
    `;

    resetGame();
    animate();
}

function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 10, 80);
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 20, 15);
    camera.lookAt(0,0,0);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);
    const light = new THREE.AmbientLight(0xffffff, 0.5);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0, 20, 0);
    dirLight.castShadow = true;
    dirLight.shadow.camera.zoom = 0.15;
    scene.add(light, dirLight);
}

function initCannon() {
    world = new CANNON.World();
    world.gravity.set(0, -20, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
}

function resetGame() {
    gameState = 'between_waves';
    score = 0;
    wave = 0;
    player.health = PLAYER_HP;
    player.lastShot = 0;
    
    player.body.position.set(0, 1, 0);
    player.body.velocity.set(0,0,0);
    
    enemies.forEach(e => { world.remove(e.body); scene.remove(e.mesh); });
    enemies = [];
    bullets.forEach(b => scene.remove(b.mesh));
    bullets = [];
    
    document.getElementById('gameover').style.display = 'none';
    startNextWave();
}

function startNextWave() {
    wave++;
    updateHUD();
    
    const waveElem = document.getElementById('wave-announcement');
    waveElem.textContent = `Wave ${wave}`;
    waveElem.style.display = 'block';

    setTimeout(() => {
        waveElem.style.display = 'none';
        for (let i = 0; i < 5 + wave * 2; i++) {
            spawnEnemy();
        }
        gameState = 'wave_in_progress';
    }, 2000);
}

function spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const radius = ARENA_SIZE / 2;
    const pos = new CANNON.Vec3(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);

    const shape = new CANNON.Sphere(0.7);
    const body = new CANNON.Body({ mass: 5, shape });
    body.position.copy(pos);
    world.addBody(body);
    
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshStandardMaterial({color: 0xff0000}));
    mesh.castShadow = true;
    scene.add(mesh);
    
    const health = ENEMY_HP + wave * 10;
    const enemy = { mesh, body, health, maxHealth: health };
    body.addEventListener('collide', e => {
        if(e.body === player.body) {
            player.health -= ENEMY_DMG;
            if(player.health <= 0) handleEndGame();
        }
    });
    enemies.push(enemy);
}


// --- GAME LOOP & LOGIC ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    
    if (gameState === 'wave_in_progress' || gameState === 'between_waves') {
        world.step(1/60, deltaTime);
        updatePlayer();
        updateEnemies();
        updateBullets(deltaTime);
        handleCollisions();
        syncMeshesToBodies();
        updateHUD();

        if (gameState === 'wave_in_progress' && enemies.length === 0) {
            gameState = 'between_waves';
            startNextWave();
        }
    } else if (keys['KeyR']) {
        resetGame();
    }
    
    renderer.render(scene, camera);
}

function updatePlayer() {
    // Movement
    const moveVel = new THREE.Vector3();
    if (keys['KeyW']) moveVel.z = -1;
    if (keys['KeyS']) moveVel.z = 1;
    if (keys['KeyA']) moveVel.x = -1;
    if (keys['KeyD']) moveVel.x = 1;
    moveVel.normalize().multiplyScalar(PLAYER_SPEED);
    player.body.velocity.x = moveVel.x;
    player.body.velocity.z = moveVel.z;

    // Aiming
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -player.body.position.y);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const worldMouse = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, worldMouse);
    if(worldMouse) {
        const lookAt = new THREE.Vector3(worldMouse.x, player.body.position.y, worldMouse.z);
        player.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0), Math.atan2(lookAt.x - player.body.position.x, lookAt.z - player.body.position.z));
    }
}

function updateEnemies() {
    enemies.forEach(e => {
        const dir = player.body.position.vsub(e.body.position);
        dir.y = 0; // Don't move up/down
        dir.normalize();
        e.body.velocity.x = dir.x * ENEMY_SPEED;
        e.body.velocity.z = dir.z * ENEMY_SPEED;
    });
}

function updateBullets(deltaTime) {
    for(let i=bullets.length-1; i>=0; i--) {
        const b = bullets[i];
        b.mesh.position.addScaledVector(b.velocity, deltaTime);
        if(b.mesh.position.length() > ARENA_SIZE) {
            scene.remove(b.mesh);
            bullets.splice(i,1);
        }
    }
}
function handleCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (bullets[i] && enemies[j] && bullets[i].mesh.position.distanceTo(enemies[j].mesh.position) < 1.0) {
                enemies[j].health -= BULLET_DMG;
                scene.remove(bullets[i].mesh);
                bullets.splice(i, 1);
                if(enemies[j].health <= 0) {
                    score += 10;
                    world.remove(enemies[j].body);
                    scene.remove(enemies[j].mesh);
                    enemies.splice(j,1);
                }
                break;
            }
        }
    }
}

function syncMeshesToBodies() {
    player.mesh.position.copy(player.body.position);
    player.mesh.quaternion.copy(player.body.quaternion);
    enemies.forEach(e => {
        e.mesh.position.copy(e.body.position);
        e.mesh.quaternion.copy(e.body.quaternion);
    });
}

function handleEndGame() {
    gameState = 'game_over';
    const go = document.getElementById('gameover');
    go.querySelector('#end-message').textContent = 'GAME OVER';
    go.querySelector('#end-score').textContent = `You survived ${wave} waves with a score of ${score}.`;
    go.querySelector('#restart-prompt').textContent = 'Press [R] to restart';
    go.style.display = 'flex';
}

function buildArena() {
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
    world.addBody(groundBody);
    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE*2, ARENA_SIZE*2), new THREE.MeshStandardMaterial({color: 0x333333}));
    groundMesh.rotation.x = -Math.PI/2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    
    const wallShape = new CANNON.Box(new CANNON.Vec3(ARENA_SIZE/2, 2, 0.5));
    const wallMat = new THREE.MeshStandardMaterial({color: 0x555555});
    for(let i=0; i<4; i++){
        const angle = i * Math.PI / 2;
        const wallBody = new CANNON.Body({mass: 0, shape: wallShape});
        wallBody.position.set(Math.sin(angle) * ARENA_SIZE/2, 1, Math.cos(angle) * ARENA_SIZE/2);
        wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0), angle);
        world.addBody(wallBody);
        const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(ARENA_SIZE, 4, 1), wallMat);
        wallMesh.position.copy(wallBody.position);
        wallMesh.quaternion.copy(wallBody.quaternion);
        scene.add(wallMesh);
    }
}
function updateHUD() {
    document.getElementById('health').textContent = `Health: ${Math.ceil(player.health)}`;
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('wave').textContent = `Wave: ${wave}`;

    // Hide unused stats
    document.getElementById('lives').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('phase').style.display = 'none';
    document.getElementById('pong-score').style.display = 'none';
    if(document.getElementById('race3d-ui')) document.getElementById('race3d-ui').style.display = 'none';
    document.getElementById('message').style.display = 'none';
    document.getElementById('countdown').style.display = 'none';

    // Specific HUD for Survival
    document.getElementById('game-stats').innerHTML = `
        <span id="health">Health: ${Math.ceil(player.health)}</span><br>
        <span id="score">Score: ${score}</span><br>
        <span id="wave">Wave: ${wave}</span>
    `;
}

function initControls() {
    window.addEventListener('keydown', e => { keys[e.code] = true; });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousemove', e => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    document.addEventListener('click', () => {
        if(gameState !== 'wave_in_progress' || clock.getElapsedTime() < player.lastShot + (FIRE_RATE/1000)) return;
        player.lastShot = clock.getElapsedTime();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -player.body.position.y);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const worldMouse = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, worldMouse);
        if(worldMouse) {
            const dir = worldMouse.clone().sub(player.body.position).normalize();
            const bullet = {
                mesh: new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({color: 0xffff00})),
                velocity: dir.multiplyScalar(BULLET_SPEED)
            };
            bullet.mesh.position.copy(player.body.position);
            bullets.push(bullet);
            scene.add(bullet.mesh);
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
})();
