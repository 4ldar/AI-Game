(function() {
// === Space Shooter 3D (Refactored) ===

// --- SETTINGS ---
const THRUST = 0.1;
const MAX_SPEED = 3.0;
const TURN_SPEED = 0.005;
const ROLL_SPEED = 0.05;
const DRAG = 0.98;
const FIRE_RATE = 200; //ms
const BULLET_SPEED = 1;
const ENEMY_SPEED = 0.05;
const ENEMY_COUNT = 10;

// --- GLOBALS ---
let scene, camera, renderer, clock;
let player, bullets = [], enemies = [], stars = [];
let keys = {}, mouse = new THREE.Vector2();
let gameState = 'playing';

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
    scene.fog = new THREE.Fog(0x000011, 50, 150);
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.5);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 10, 10);
    scene.add(light, dirLight);

    const playerGeo = new THREE.ConeGeometry(0.5, 2, 8);
    player = new THREE.Mesh(playerGeo, new THREE.MeshStandardMaterial({color: 0x00ff00, metalness: 0.2, roughness: 0.6}));
    player.userData = {
        velocity: new THREE.Vector3(),
        health: 100,
        score: 0,
        lastShot: 0
    };
    scene.add(player);
    
    for (let i = 0; i < 500; i++) {
        const star = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0xffffff}));
        star.position.set((Math.random()-0.5)*200, (Math.random()-0.5)*200, (Math.random()-0.5)*200);
        stars.push(star);
        scene.add(star);
    }
    
    document.getElementById('info').innerHTML = `
        <b>3D Space Shooter</b><br>
        <span>Mouse : Steer | [W/S] : Thrust</span><br>
        <span>[A/D] : Roll | [SPACE] : Shoot</span>
    `;

    initControls();
    resetGame();
    animate();
}

function resetGame() {
    gameState = 'playing';
    player.userData.health = 100;
    player.userData.score = 0;
    player.position.set(0, 0, 0);
    player.quaternion.set(0,0,0,1);
    player.userData.velocity.set(0,0,0);
    
    enemies.forEach(e => scene.remove(e));
    enemies = [];
    bullets.forEach(b => scene.remove(b));
    bullets = [];

    for (let i = 0; i < ENEMY_COUNT; i++) spawnEnemy();
    document.getElementById('gameover').style.display = 'none';
}

function spawnEnemy() {
    const enemy = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color: 0xff0000}));
    const dist = 30 + Math.random() * 50;
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI * 2;
    enemy.position.set(
        Math.sin(angle1) * Math.cos(angle2) * dist,
        Math.sin(angle1) * Math.sin(angle2) * dist,
        Math.cos(angle1) * dist
    );
    enemies.push(enemy);
    scene.add(enemy);
}

function updatePlayer() {
    const pData = player.userData;

    // Steering
    player.rotateY(-mouse.x * TURN_SPEED);
    player.rotateX(-mouse.y * TURN_SPEED);

    // Roll
    if (keys['KeyA']) player.rotateZ(ROLL_SPEED);
    if (keys['KeyD']) player.rotateZ(-ROLL_SPEED);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);

    // Thrust
    let thrust = 0;
    if (keys['KeyW']) thrust = THRUST;
    if (keys['KeyS']) thrust = -THRUST;
    
    pData.velocity.add(forward.multiplyScalar(thrust));
    pData.velocity.multiplyScalar(DRAG); // Drag
    pData.velocity.clampLength(0, MAX_SPEED); // Speed limit
    player.position.add(pData.velocity);

    // Shooting
    if (keys['Space'] && clock.getElapsedTime() > pData.lastShot + (FIRE_RATE / 1000)) {
        pData.lastShot = clock.getElapsedTime();
        const bulletDir = new THREE.Vector3(0,0,-1).applyQuaternion(player.quaternion);
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({color: 0xffff00}));
        bullet.position.copy(player.position).add(bulletDir.multiplyScalar(1.5));
        bullet.userData.velocity = bulletDir.multiplyScalar(BULLET_SPEED).add(pData.velocity);
        bullets.push(bullet);
        scene.add(bullet);
    }
}

function updateEntities() {
    // Enemies seek player
    enemies.forEach(e => {
        const dir = player.position.clone().sub(e.position).normalize();
        e.position.add(dir.multiplyScalar(ENEMY_SPEED));
    });
    // Move bullets
    for (let i = bullets.length-1; i >= 0; i--) {
        const b = bullets[i];
        b.position.add(b.userData.velocity);
        if(b.position.distanceTo(player.position) > 150) {
            scene.remove(b);
            bullets.splice(i, 1);
        }
    }
}

function handleCollisions() {
    // Bullets vs Enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (bullets[i] && enemies[j] && bullets[i].position.distanceTo(enemies[j].position) < 1.0) {
                scene.remove(enemies[j]);
                enemies.splice(j, 1);
                scene.remove(bullets[i]);
                bullets.splice(i, 1);
                player.userData.score += 10;
                spawnEnemy();
                break;
            }
        }
    }
    // Player vs Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (player.position.distanceTo(enemies[i].position) < 1.2) {
            player.userData.health -= 10;
            scene.remove(enemies[i]);
            enemies.splice(i, 1);
            if (player.userData.health <= 0) {
                handleEndGame();
                return;
            }
            spawnEnemy();
        }
    }
}


function updateCamera() {
    const offset = new THREE.Vector3(0, 2, 5);
    offset.applyQuaternion(player.quaternion);
    offset.add(player.position);
    camera.position.lerp(offset, 0.1);
    
    const lookAtTarget = player.position.clone().add(player.userData.velocity.clone().multiplyScalar(5));
    camera.lookAt(lookAtTarget);
}

function handleEndGame() {
    gameState = 'game_over';
    const go = document.getElementById('gameover');
    go.querySelector('#end-message').textContent = 'GAME OVER';
    go.querySelector('#end-score').textContent = `Final Score: ${player.userData.score}`;
    go.querySelector('#restart-prompt').textContent = 'Press [R] to restart';
    go.style.display = 'flex';
}

function updateHUD() {
    document.getElementById('health').textContent = `Health: ${player.userData.health}`;
    document.getElementById('score').textContent = `Score: ${player.userData.score}`;

    // Hide unused stats
    document.getElementById('lives').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('phase').style.display = 'none';
    document.getElementById('pong-score').style.display = 'none';
    if(document.getElementById('race3d-ui')) document.getElementById('race3d-ui').style.display = 'none';
    document.getElementById('message').style.display = 'none';
    document.getElementById('countdown').style.display = 'none';

    // Specific HUD for Shooter
    document.getElementById('game-stats').innerHTML = `
        <span id="health">Health: ${player.userData.health}</span><br>
        <span id="score">Score: ${player.userData.score}</span>
    `;
}

function initControls() {
    window.addEventListener('keydown', e => { keys[e.code] = true; });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('mousemove', e => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    if(gameState === 'playing') {
        updatePlayer();
        updateEntities();
        handleCollisions();
        updateCamera();
        updateHUD();
    } else if (keys['KeyR']) {
        resetGame();
    }
    
    renderer.render(scene, camera);
}

init();
})();
