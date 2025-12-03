(function() {
// === RPG 3D (Refactored w/ Cannon.js) ===

// --- SETTINGS ---
const GRAVITY = -15;
const PLAYER_SPEED = 5;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.5;
const ATTACK_COOLDOWN = 500;
const ATTACK_RANGE = 2.5;
const ATTACK_DAMAGE = 15;
const ENEMY_COUNT = 5;

// --- GLOBALS ---
let scene, camera, renderer, world, clock;
let player, enemies = [], items = [];
let keys = {}, euler = new THREE.Euler(0, 0, 0, 'YXZ');
let gameState = 'playing';

function init() {
    initThree();
    initCannon();
    initControls();
    buildWorld();
    resetGame();
    animate();
}

function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5a8236);
    scene.fog = new THREE.Fog(0x5a8236, 10, 80);
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);
    const light = new THREE.AmbientLight(0xffffff, 0.6);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 30, 15);
    dirLight.castShadow = true;
    scene.add(light, dirLight);

    document.getElementById('info').innerHTML = `
        <b>3D Action RPG</b><br>
        <span>[CLICK] to lock mouse</span><br>
        <span>[WASD] : Move | [SPACE] : Attack</span>
    `;
}

function initCannon() {
    world = new CANNON.World();
    world.gravity.set(0, GRAVITY, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
}

function resetGame() {
    gameState = 'playing';
    enemies.forEach(e => { world.remove(e.body); scene.remove(e.mesh); });
    enemies = [];
    items.forEach(i => scene.remove(i.mesh));
    items = [];
    
    const pData = player.userData;
    pData.body.position.set(0, 5, 0);
    pData.body.velocity.set(0,0,0);
    pData.stats = { hp: 100, maxHp: 100, level: 1, exp: 0, expToNext: 50, gold: 0 };
    
    for (let i = 0; i < ENEMY_COUNT; i++) spawnEnemy();
    for (let i = 0; i < 3; i++) spawnItem('gold');

    document.getElementById('gameover').style.display = 'none';
    updateHUD();
}

function buildWorld() {
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
    world.addBody(groundBody);
    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshStandardMaterial({color: 0x4a5d23}));
    groundMesh.rotation.x = -Math.PI/2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Player object
    const playerShape = new CANNON.Sphere(PLAYER_RADIUS);
    const playerBody = new CANNON.Body({ mass: 10, shape: playerShape, linearDamping: 0.9 });
    playerBody.position.y = 5;
    world.addBody(playerBody);
    player = new THREE.Group();
    player.add(camera);
    player.userData = { body: playerBody, lastAttack: 0 };
    scene.add(player);
}

function spawnEnemy() {
    const level = player.userData.stats.level;
    const shape = new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5));
    const body = new CANNON.Body({ mass: 5, shape });
    const angle = Math.random() * Math.PI * 2;
    const distance = 10 + Math.random() * 20;
    body.position.set(Math.cos(angle)*distance, 5, Math.sin(angle)*distance);
    world.addBody(body);
    
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshStandardMaterial({color: 0xff0000}));
    mesh.castShadow = true;
    scene.add(mesh);
    
    const stats = { hp: 30 + level * 10, maxHp: 30 + level * 10, damage: 5 + level, exp: 10, gold: 5 };
    const enemy = { mesh, body, stats, lastDamage: 0 };
    
    body.addEventListener('collide', e => {
        if(e.body === player.userData.body && clock.getElapsedTime() > enemy.lastDamage + 1) {
            player.userData.stats.hp -= stats.damage;
            enemy.lastDamage = clock.getElapsedTime();
            if(player.userData.stats.hp <= 0) handleEndGame();
        }
    });
    enemies.push(enemy);
}

function spawnItem(type) {
    const geo = type === 'gold' ? new THREE.TorusGeometry(0.2, 0.1, 8, 16) : new THREE.SphereGeometry(0.3, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: type === 'gold' ? 0xffd700 : 0xee82ee });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((Math.random() - 0.5) * 40, 0.5, (Math.random() - 0.5) * 30); // Ensure it's on the ground
    
    // Create a CANNON.Body for collision detection (optional, could be sphere)
    const shape = new CANNON.Sphere(0.3);
    const body = new CANNON.Body({ mass: 0, shape: shape }); // Mass 0 for static item
    body.position.copy(mesh.position);
    world.addBody(body);

    const item = { mesh, body, type };
    items.push(item);
    scene.add(mesh);
}


function updatePlayer(deltaTime) {
    const pBody = player.userData.body;
    const moveDirection = new THREE.Vector3();
    if (keys['KeyW']) moveDirection.z = -1;
    if (keys['KeyS']) moveDirection.z = 1;
    if (keys['KeyA']) moveDirection.x = -1;
    if (keys['KeyD']) moveDirection.x = 1;
    
    if(moveDirection.lengthSq() > 0) {
        moveDirection.normalize().applyQuaternion(camera.quaternion);
        pBody.velocity.x = moveDirection.x * PLAYER_SPEED;
        pBody.velocity.z = moveDirection.z * PLAYER_SPEED;
    }

    if (keys['Space'] && clock.getElapsedTime() > player.userData.lastAttack + (ATTACK_COOLDOWN/1000)) {
        player.userData.lastAttack = clock.getElapsedTime();
        enemies.forEach(enemy => {
            if (pBody.position.distanceTo(enemy.body.position) < ATTACK_RANGE) {
                enemy.stats.hp -= ATTACK_DAMAGE;
            }
        });
    }
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy.stats.hp <= 0) {
            world.remove(enemy.body);
            scene.remove(enemy.mesh);
            enemies.splice(i, 1);
            
            const pStats = player.userData.stats;
            pStats.exp += enemy.stats.exp;
            pStats.gold += enemy.stats.gold;
            if(pStats.exp >= pStats.expToNext) {
                pStats.level++;
                pStats.exp = 0;
                pStats.expToNext *= 1.5;
                pStats.hp = pStats.maxHp;
            }
            spawnEnemy();
            continue;
        }
        
        const dir = player.userData.body.position.clone().vsub(enemy.body.position);
        if(dir.lengthSquared() < 100) { // Aggro range
            dir.normalize();
            enemy.body.velocity.x = dir.x * 3;
            enemy.body.velocity.z = dir.z * 3;
        }
    }
}

function handleEndGame() {
    gameState = 'game_over';
    const go = document.getElementById('gameover');
    go.querySelector('#end-message').textContent = 'YOU DIED';
    go.querySelector('#end-score').textContent = `You reached level ${player.userData.stats.level} with ${player.userData.stats.gold} gold!`;
    go.querySelector('#restart-prompt').textContent = 'Press [R] to restart';
    go.style.display = 'flex';
    document.exitPointerLock();
}

function updateHUD() {
    const { hp, maxHp, level, exp, gold } = player.userData.stats;
    document.getElementById('hp').textContent = `HP: ${Math.ceil(hp)} / ${maxHp}`;
    document.getElementById('level').textContent = `LVL: ${level}`;
    document.getElementById('exp').textContent = `EXP: ${exp}`;
    document.getElementById('gold').textContent = `Gold: ${gold}`;
    
    document.getElementById('score').style.display = 'none'; // Hide unused stats
    document.getElementById('lives').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('phase').style.display = 'none';
    document.getElementById('pong-score').style.display = 'none';
}

function initControls() {
    const dom = renderer.domElement;
    dom.addEventListener('click', () => dom.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
        document.getElementById('crosshair').style.display = document.pointerLockElement === dom ? 'block' : 'none';
    });
    document.addEventListener('mousemove', e => {
        if (document.pointerLockElement !== dom) return;
        player.rotation.y -= e.movementX * 0.002;
        camera.rotation.x -= e.movementY * 0.002;
        camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x, -Math.PI / 2, Math.PI / 2);
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

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    world.step(1/60, deltaTime);
    
    if (gameState === 'playing') {
        updatePlayer(deltaTime);
        updateEnemies();
        updateHUD();
    } else if (keys['KeyR']) {
        resetGame();
    }
    
    enemies.forEach(e => {
        e.mesh.position.copy(e.body.position);
        e.mesh.quaternion.copy(e.body.quaternion);
    });
    player.position.copy(player.userData.body.position);
    player.quaternion.copy(player.userData.body.quaternion);
    
    renderer.render(scene, camera);
}

init();
})();
