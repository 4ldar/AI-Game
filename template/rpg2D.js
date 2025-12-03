(function() {
// === RPG 2D Game (Refactored) ===

// Settings
const PLAYER_SPEED = 0.15;
const PLAYER_MAX_HP = 100;
const ATTACK_COOLDOWN = 400; // ms
const ATTACK_RANGE = 1.8;
const ATTACK_DAMAGE = 10;
const ENEMY_SPEED = 0.03;
const ENEMY_MAX_COUNT = 8;

// Globals
let scene, camera, renderer, clock;
let player, attackIndicator;
let enemies = [], items = [];
let keys = {};
let isGameOver = false;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3a5a3a);
    clock = new THREE.Clock();

    const aspect = window.innerWidth/window.innerHeight;
    camera = new THREE.OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, 0.1, 100);
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(light);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    player = createCharacter(0x00ff00, {
        level: 1, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP,
        gold: 0, exp: 0, expToNextLevel: 50,
        lastAttack: 0
    });
    
    attackIndicator = new THREE.Mesh(new THREE.RingGeometry(ATTACK_RANGE-0.1, ATTACK_RANGE, 32), new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.DoubleSide}));
    attackIndicator.visible = false;
    scene.add(attackIndicator);

    document.getElementById('info').innerHTML = `
        <b>Action RPG</b><br>
        <span>[WASD] / [ARROWS] : Move</span><br>
        <span>[SPACE] : Attack</span>
    `;

    resetGame();
    window.addEventListener('keydown', e => { keys[e.code] = true; });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('resize', onWindowResize);
    animate();
}

function createCharacter(color, data) {
    const geo = new THREE.CircleGeometry(0.5, 32);
    const mat = new THREE.MeshStandardMaterial({ color });
    const char = new THREE.Mesh(geo, mat);
    char.userData = data;
    
    const healthBarGeo = new THREE.PlaneGeometry(1, 0.15);
    const healthBarMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    char.userData.healthBar = new THREE.Mesh(healthBarGeo, healthBarMat);
    char.userData.healthBar.position.y = 0.8;
    char.add(char.userData.healthBar);

    scene.add(char);
    return char;
}

function resetGame() {
    isGameOver = false;
    player.position.set(0, 0, 0);
    player.userData.hp = PLAYER_MAX_HP;
    player.userData.level = 1;
    player.userData.gold = 0;
    player.userData.exp = 0;
    player.userData.expToNextLevel = 50;

    enemies.forEach(e => scene.remove(e));
    items.forEach(i => scene.remove(i));
    enemies = []; items = [];
    
    for (let i = 0; i < ENEMY_MAX_COUNT; i++) spawnEnemy();
    for (let i = 0; i < 3; i++) spawnItem('gold');

    updateHUD();
    document.getElementById('gameover').style.display = 'none';
}

function spawnEnemy() {
    const level = player.userData.level;
    const enemy = createCharacter(0xff0000, {
        hp: 20 + level * 5,
        maxHp: 20 + level * 5,
        damage: 5 + level * 2,
        exp: 10 + level * 2,
        gold: 3 + level
    });
    enemy.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, 0);
    enemies.push(enemy);
}

function spawnItem(type) {
    const geo = type === 'gold' ? new THREE.TorusGeometry(0.2, 0.1, 8, 16) : new THREE.SphereGeometry(0.3, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: type === 'gold' ? 0xffd700 : 0xee82ee });
    const item = new THREE.Mesh(geo, mat);
    item.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, 0);
    item.userData.type = type;
    items.push(item);
    scene.add(item);
}


function updatePlayer() {
    let moveX = 0, moveY = 0;
    if (keys['KeyW'] || keys['ArrowUp']) moveY = 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveY = -1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveX = -1;
    if (keys['KeyD'] || keys['ArrowRight']) moveX = 1;
    
    const moveVec = new THREE.Vector2(moveX, moveY).normalize().multiplyScalar(PLAYER_SPEED);
    player.position.x += moveVec.x;
    player.position.y += moveVec.y;
    
    if (keys['Space'] && clock.getElapsedTime() > player.userData.lastAttack + (ATTACK_COOLDOWN/1000)) {
        player.userData.lastAttack = clock.getElapsedTime();
        attackIndicator.position.copy(player.position);
        attackIndicator.scale.set(0.1,0.1,0.1);
        attackIndicator.visible = true;
        
        enemies.forEach(enemy => {
            if (player.position.distanceTo(enemy.position) < ATTACK_RANGE) {
                enemy.userData.hp -= ATTACK_DAMAGE;
            }
        });
    }
}

function updateEntities() {
    if(attackIndicator.visible) {
        attackIndicator.scale.lerp(new THREE.Vector3(1,1,1), 0.3);
        if(attackIndicator.scale.x > 0.9) attackIndicator.visible = false;
    }
    
    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy.userData.hp <= 0) {
            player.userData.exp += enemy.userData.exp;
            player.userData.gold += enemy.userData.gold;
            if (player.userData.exp >= player.userData.expToNextLevel) {
                player.userData.level++;
                player.userData.exp = 0;
                player.userData.expToNextLevel *= 1.5;
                player.userData.hp = player.userData.maxHp;
            }
            if(Math.random() < 0.2) spawnItem('potion');
            scene.remove(enemy);
            enemies.splice(i, 1);
            spawnEnemy();
            continue;
        }
        
        const dir = player.position.clone().sub(enemy.position);
        if (dir.length() < 10) {
            enemy.position.add(dir.normalize().multiplyScalar(ENEMY_SPEED));
        }
        if (player.position.distanceTo(enemy.position) < 1.0) {
            player.userData.hp -= 0.2;
            if (player.userData.hp <= 0) handleEndGame();
        }
        
        const hpRatio = enemy.userData.hp / enemy.userData.maxHp;
        enemy.userData.healthBar.scale.x = hpRatio;
        enemy.userData.healthBar.material.color.set(hpRatio < 0.3 ? 0xff0000 : 0x00ff00);
    }
    
    // Items
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.rotation.z += 0.05;
        if (player.position.distanceTo(item.position) < 1.0) {
            if (item.userData.type === 'gold') player.userData.gold += 10;
            if (item.userData.type === 'potion') player.userData.hp = Math.min(player.userData.maxHp, player.userData.hp + 25);
            scene.remove(item);
            items.splice(i, 1);
        }
    }
}

function handleEndGame() {
    isGameOver = true;
    const go = document.getElementById('gameover');
    document.getElementById('end-message').textContent = 'YOU DIED';
    document.getElementById('end-score').textContent = `You reached level ${player.userData.level} with ${player.userData.gold} gold!`;
    document.getElementById('restart-prompt').textContent = 'Press [ENTER] to restart';
    go.style.display = 'flex';
}

function updateCamera() {
    camera.position.x += (player.position.x - camera.position.x) * 0.1;
    camera.position.y += (player.position.y - camera.position.y) * 0.1;
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -10 * aspect;
    camera.right = 10 * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateHUD() {
    const pData = player.userData;
    document.getElementById('score').style.display = 'none'; // Hide score for this game
    document.getElementById('lives').style.display = 'none'; // Hide lives for this game
    document.getElementById('timer').style.display = 'none'; // Hide timer for this game
    document.getElementById('phase').style.display = 'none'; // Hide phase for this game
    document.getElementById('pong-score').style.display = 'none'; // Hide pong-score for this game

    // Specific HUD for RPG
    document.getElementById('game-stats').innerHTML = `
        <span id="hp">HP: ${Math.ceil(pData.hp)} / ${pData.maxHp}</span><br>
        <span id="level">Level: ${pData.level}</span><br>
        <span id="gold">Gold: ${pData.gold}</span>
    `;
    
    pData.healthBar.scale.x = pData.hp / pData.maxHp;
    pData.healthBar.material.color.set(pData.hp / pData.maxHp < 0.3 ? 0xff0000 : 0x00ff00);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (isGameOver) {
        if (keys['Enter']) resetGame();
    } else {
        updatePlayer();
        updateEntities();
        updateCamera();
        updateHUD();
    }
    
    renderer.render(scene, camera);
}

init();
})();
