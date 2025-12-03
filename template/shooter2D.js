(function() {
// === Shooter 2D Game (Refactored) ===

// Settings
const WORLD_W = 28;
const WORLD_H = 18;
const PLAYER_SPEED = 0.2;
const PLAYER_HEALTH = 100;
const ENEMY_SPEED = 0.03;
const ENEMY_COUNT = 8;
const BULLET_SPEED = 0.6;
const FIRE_RATE = 200; //ms

// Globals
let scene, camera, renderer;
let player, bullets = [], enemies = [];
let keys = {}, mouse = new THREE.Vector2();
let score, health;
let isGameOver = false;
let lastShotTime = 0;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.OrthographicCamera(-WORLD_W / 2, WORLD_W / 2, WORLD_H / 2, -WORLD_H / 2, 0.1, 100);
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(light);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const playerGeo = new THREE.ConeGeometry(0.5, 1, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    player = new THREE.Mesh(playerGeo, playerMat);
    scene.add(player);
    
    buildWalls();
    resetGame();

    document.getElementById('info').innerHTML = `
        <b>Top-Down Shooter</b><br>
        <span>[WASD] : Move</span><br>
        <span>Mouse : Aim & Shoot</span>
    `;

    window.addEventListener('keydown', e => { keys[e.code] = true; });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', shoot);
    window.addEventListener('resize', onWindowResize);
    
    animate();
}

function resetGame() {
    isGameOver = false;
    score = 0;
    health = PLAYER_HEALTH;

    player.position.set(0, 0, 0);
    player.visible = true;

    bullets.forEach(b => scene.remove(b));
    enemies.forEach(e => scene.remove(e));
    bullets = [];
    enemies = [];

    for (let i = 0; i < ENEMY_COUNT; i++) {
        spawnEnemy();
    }
    
    updateHUD();
    document.getElementById('gameover').style.display = 'none';
}

function spawnEnemy() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    const enemy = new THREE.Mesh(geo, mat);
    
    let validPos = false;
    while(!validPos) {
        enemy.position.set(
            (Math.random() - 0.5) * (WORLD_W - 2),
            (Math.random() - 0.5) * (WORLD_H - 2),
            0
        );
        if (enemy.position.distanceTo(player.position) > 5) {
            validPos = true;
        }
    }
    
    enemies.push(enemy);
    scene.add(enemy);
}

function updatePlayer() {
    if (keys['KeyW'] || keys['ArrowUp']) player.position.y += PLAYER_SPEED;
    if (keys['KeyS'] || keys['ArrowDown']) player.position.y -= PLAYER_SPEED;
    if (keys['KeyA'] || keys['ArrowLeft']) player.position.x -= PLAYER_SPEED;
    if (keys['KeyD'] || keys['ArrowRight']) player.position.x += PLAYER_SPEED;

    // Aim towards mouse
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const worldMouse = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, worldMouse);
    
    const angle = Math.atan2(worldMouse.y - player.position.y, worldMouse.x - player.position.x);
    player.rotation.z = angle - Math.PI / 2;
}

function updateEntities() {
    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.position.add(b.userData.velocity);
        if (Math.abs(b.position.x) > WORLD_W / 2 || Math.abs(b.position.y) > WORLD_H / 2) {
            scene.remove(b);
            bullets.splice(i, 1);
        }
    }
    // Enemies
    enemies.forEach(enemy => {
        const dir = player.position.clone().sub(enemy.position).normalize();
        enemy.position.add(dir.multiplyScalar(ENEMY_SPEED));
    });
}

function handleCollisions() {
    const halfW = WORLD_W / 2 - 0.5;
    const halfH = WORLD_H / 2 - 0.5;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -halfW, halfW);
    player.position.y = THREE.MathUtils.clamp(player.position.y, -halfH, halfH);

    // Bullets vs Enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (bullets[i] && enemies[j] && bullets[i].position.distanceTo(enemies[j].position) < 0.8) {
                scene.remove(bullets[i]);
                scene.remove(enemies[j]);
                bullets.splice(i, 1);
                enemies.splice(j, 1);
                score += 10;
                spawnEnemy();
                break;
            }
        }
    }
    
    // Player vs Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i] && player.position.distanceTo(enemies[i].position) < 1.0) {
            health -= 0.5;
            if (health <= 0) {
                health = 0;
                handleEndGame();
            }
        }
    }
}

function shoot() {
    if (isGameOver || Date.now() - lastShotTime < FIRE_RATE) return;
    lastShotTime = Date.now();

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const worldMouse = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, worldMouse);
    
    const dir = worldMouse.clone().sub(player.position).normalize();

    const geo = new THREE.SphereGeometry(0.15, 8, 8);
    const mat = new THREE.MeshStandardMaterial({color: 0xffff00, emissive: 0xcccc00});
    const bullet = new THREE.Mesh(geo, mat);
    bullet.position.copy(player.position);
    bullet.userData.velocity = dir.multiplyScalar(BULLET_SPEED);
    
    bullets.push(bullet);
    scene.add(bullet);
}


function handleEndGame() {
    isGameOver = true;
    player.visible = false;
    const go = document.getElementById('gameover');
    document.getElementById('end-message').textContent = 'GAME OVER';
    document.getElementById('end-score').textContent = `Final Score: ${score}`;
    document.getElementById('restart-prompt').textContent = 'Press [ENTER] to restart';
    go.style.display = 'flex';
}

function buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({color: 0x4a4a6e});
    const T = 0.5; // thickness
    const top = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, T, T), wallMat);
    top.position.set(0, WORLD_H / 2, 0);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, T, T), wallMat);
    bottom.position.set(0, -WORLD_H / 2, 0);
    const left = new THREE.Mesh(new THREE.BoxGeometry(T, WORLD_H, T), wallMat);
    left.position.set(-WORLD_W / 2, 0, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(T, WORLD_H, T), wallMat);
    right.position.set(WORLD_W / 2, 0, 0);
    scene.add(top, bottom, left, right);
}

function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -WORLD_W / 2;
    camera.right = WORLD_W / 2;
    camera.top = WORLD_H / 2;
    camera.bottom = -WORLD_H / 2;
    if (aspect > WORLD_W / WORLD_H) {
        camera.left *= aspect / (WORLD_W / WORLD_H);
        camera.right *= aspect / (WORLD_W / WORLD_H);
    } else {
        camera.top /= aspect / (WORLD_W / WORLD_H);
        camera.bottom /= aspect / (WORLD_W / WORLD_H);
    }
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateHUD() {
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('lives').style.display = 'none'; // Hide lives for this game
    document.getElementById('timer').style.display = 'none'; // Hide timer for this game
    document.getElementById('phase').style.display = 'none'; // Hide phase for this game
    document.getElementById('pong-score').style.display = 'none'; // Hide pong-score for this game
    document.getElementById('health').textContent = `Health: ${Math.ceil(health)}`;
    document.getElementById('game-stats').innerHTML = `
        <span id="health">Health: ${Math.ceil(health)}</span><br>
        <span id="score">Score: ${score}</span>
    `;
}

function animate() {
    requestAnimationFrame(animate);
    if (isGameOver) {
        if(keys['Enter']) resetGame();
    } else {
        updatePlayer();
        updateEntities();
        handleCollisions();
        updateHUD();
    }
    renderer.render(scene, camera);
}

init();
})();
