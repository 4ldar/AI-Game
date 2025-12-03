(function() {
// === Survival 2D Game (Refactored) ===

// Settings
const WORLD_W = 24, WORLD_H = 18;
const PLAYER_SPEED = 0.2, PLAYER_HEALTH = 100;
const FIRE_RATE = 200, BULLET_SPEED = 0.5, BULLET_DMG = 10;
const ENEMY_BASE_SPEED = 0.04, ENEMY_BASE_HEALTH = 20, ENEMY_DMG = 10;

// Globals
let scene, camera, renderer, clock;
let player, bullets = [], enemies = [];
let keys = {}, mouse = new THREE.Vector2();
let score, wave;
let gameState = 'playing'; // playing, wave_end, game_over

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    clock = new THREE.Clock();

    camera = new THREE.OrthographicCamera(-WORLD_W / 2, WORLD_W / 2, WORLD_H / 2, -WORLD_H / 2, 0.1, 100);
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(light);
    
    player = createCharacter(0x00ff00, { health: PLAYER_HEALTH, maxHealth: PLAYER_HEALTH, lastShot: 0 });
    scene.add(player);

    buildWalls();
    resetGame();

    document.getElementById('info').innerHTML = `
        <b>Wave Survival</b><br>
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

function createCharacter(color, data) {
    const geo = new THREE.CircleGeometry(0.5, 24);
    const mat = new THREE.MeshStandardMaterial({ color });
    const char = new THREE.Mesh(geo, mat);
    char.userData = data;
    return char;
}

function resetGame() {
    gameState = 'wave_end';
    score = 0;
    wave = 0;
    player.userData.health = PLAYER_HEALTH;
    player.position.set(0, 0, 0);

    bullets.forEach(b => scene.remove(b));
    enemies.forEach(e => scene.remove(e));
    bullets = [], enemies = [];
    
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
        spawnEnemies(3 + wave * 2);
        gameState = 'playing';
    }, 2000);
}

function spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
        const health = ENEMY_BASE_HEALTH + wave * 5;
        const enemy = createCharacter(0xff0000, {
            health, maxHealth: health,
            speed: ENEMY_BASE_SPEED + wave * 0.005,
            points: 10 * wave
        });
        
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = -WORLD_W/2-1; y = (Math.random() - 0.5) * WORLD_H; }
        else if (side === 1) { x = WORLD_W/2+1; y = (Math.random() - 0.5) * WORLD_H; }
        else if (side === 2) { x = (Math.random() - 0.5) * WORLD_W; y = -WORLD_H/2-1; }
        else { x = (Math.random() - 0.5) * WORLD_W; y = WORLD_H/2+1; }
        enemy.position.set(x, y, 0);
        
        enemies.push(enemy);
        scene.add(enemy);
    }
}

function updatePlayer() {
    if (keys['KeyW'] || keys['ArrowUp']) player.position.y += PLAYER_SPEED;
    if (keys['KeyS'] || keys['ArrowDown']) player.position.y -= PLAYER_SPEED;
    if (keys['KeyA'] || keys['ArrowLeft']) player.position.x -= PLAYER_SPEED;
    if (keys['KeyD'] || keys['ArrowRight']) player.position.x += PLAYER_SPEED;
    
    const halfW = WORLD_W / 2 - 0.5;
    const halfH = WORLD_H / 2 - 0.5;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -halfW, halfW);
    player.position.y = THREE.MathUtils.clamp(player.position.y, -halfH, halfH);
}

function updateEntities() {
    bullets.forEach(b => b.position.add(b.userData.velocity));
    enemies.forEach(e => {
        const dir = player.position.clone().sub(e.position).normalize();
        e.position.add(dir.multiplyScalar(e.userData.speed));
    });
}

function handleCollisions() {
    // Bullets vs Enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (bullets[i] && enemies[j] && bullets[i].position.distanceTo(enemies[j].position) < 0.8) {
                enemies[j].userData.health -= BULLET_DMG;
                if(enemies[j].userData.health <= 0) {
                    score += enemies[j].userData.points;
                    scene.remove(enemies[j]);
                    enemies.splice(j, 1);
                }
                scene.remove(bullets[i]);
                bullets.splice(i, 1);
                break;
            }
        }
    }
    
    // Player vs Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i] && player.position.distanceTo(enemies[i].position) < 1.0) {
            player.userData.health -= ENEMY_DMG;
            scene.remove(enemies[i]);
            enemies.splice(i, 1);
            if (player.userData.health <= 0) {
                handleEndGame();
                return;
            }
        }
    }
    
    if (enemies.length === 0 && gameState === 'playing') {
        gameState = 'wave_end';
        setTimeout(startNextWave, 1000);
    }
}

function shoot() {
    if (gameState !== 'playing' || clock.getElapsedTime() < player.userData.lastShot + (FIRE_RATE/1000)) return;
    player.userData.lastShot = clock.getElapsedTime();

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
    gameState = 'game_over';
    const go = document.getElementById('gameover');
    go.querySelector('#end-message').textContent = 'GAME OVER';
    go.querySelector('#end-score').textContent = `You survived ${wave-1} waves with a score of ${score}!`;
    go.querySelector('#restart-prompt').textContent = 'Press [ENTER] to restart';
    go.style.display = 'flex';
}

function buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({color: 0x4a4a6e});
    const T = 0.5;
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
    camera.left = -WORLD_W / 2; camera.right = WORLD_W / 2;
    camera.top = WORLD_H / 2; camera.bottom = -WORLD_H / 2;
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
    document.getElementById('health').textContent = `Health: ${Math.ceil(player.userData.health)}`;
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
        <span id="health">Health: ${Math.ceil(player.userData.health)}</span><br>
        <span id="score">Score: ${score}</span><br>
        <span id="wave">Wave: ${wave}</span>
    `;
}

function animate() {
    requestAnimationFrame(animate);
    
    switch(gameState) {
        case 'playing':
            updatePlayer();
            updateEntities();
            handleCollisions();
            updateHUD();
            break;
        case 'game_over':
            if (keys['Enter']) resetGame();
            break;
    }
    
    renderer.render(scene, camera);
}

init();
