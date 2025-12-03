(function() {
// === Space Shooter 2D (Refactored) ===

// Game Settings
const WORLD_W = 20;
const WORLD_H = 16;
const PLAYER_SPEED = 0.2;
const PLAYER_HEALTH_INIT = 100;
const PLAYER_DAMAGE = 20;
const BULLET_SPEED = 0.5;
const FIRE_RATE = 200; // ms
const ENEMY_SPEED = 0.08;
const ENEMY_SPAWN_RATE = 0.02; // probability per frame

// Globals
let scene, camera, renderer;
let player, stars = [];
let bullets = [], enemies = [];
let keys = {};
let score, health;
let isGameOver = false;
let lastShotTime = 0;

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);

    // Camera
    camera = new THREE.OrthographicCamera(-WORLD_W / 2, WORLD_W / 2, WORLD_H / 2, -WORLD_H / 2, 0.1, 100);
    camera.position.z = 10;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.5);
    directional.position.set(5, 5, 5);
    scene.add(directional);

    // Stars
    for (let i = 0; i < 200; i++) {
        const starGeo = new THREE.SphereGeometry(0.05, 4, 4);
        const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const star = new THREE.Mesh(starGeo, starMat);
        star.position.set(
            (Math.random() - 0.5) * WORLD_W * 2,
            (Math.random() - 0.5) * WORLD_H * 2,
            -5
        );
        stars.push(star);
        scene.add(star);
    }
    
    // Player
    const playerGeo = new THREE.ConeGeometry(0.5, 1, 4);
    const playerMat = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.rotation.z = Math.PI;
    scene.add(player);

    document.getElementById('info').innerHTML = `
        <b>Space Shooter 2D</b><br>
        <span>[WASD] / [ARROWS] : Move</span><br>
        <span>[SPACE] : Shoot</span>
    `;

    resetGame();

    // Event Listeners
    window.addEventListener('keydown', e => { keys[e.code] = true; });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('resize', onWindowResize);

    animate();
}

function resetGame() {
    // Clear old objects
    bullets.forEach(b => scene.remove(b));
    enemies.forEach(e => scene.remove(e));
    bullets = [];
    enemies = [];

    // Reset state
    score = 0;
    health = PLAYER_HEALTH_INIT;
    isGameOver = false;
    document.getElementById('gameover').style.display = 'none';
    
    player.position.set(0, -WORLD_H/2 + 1, 0);
    player.visible = true;

    updateHUD();
}

function gameOver() {
    isGameOver = true;
    player.visible = false;
    document.getElementById('gameover').style.display = 'block';
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -WORLD_W / 2 * aspect;
    camera.right = WORLD_W / 2 * aspect;
    // Keep height constant
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updatePlayer() {
    const bounds = {
        x: camera.right,
        y: camera.top
    };

    if (keys['KeyW'] || keys['ArrowUp']) player.position.y = Math.min(bounds.y - 0.5, player.position.y + PLAYER_SPEED);
    if (keys['KeyS'] || keys['ArrowDown']) player.position.y = Math.max(-bounds.y + 0.5, player.position.y - PLAYER_SPEED);
    if (keys['KeyA'] || keys['ArrowLeft']) player.position.x = Math.max(-bounds.x + 0.5, player.position.x - PLAYER_SPEED);
    if (keys['KeyD'] || keys['ArrowRight']) player.position.x = Math.min(bounds.x - 0.5, player.position.x + PLAYER_SPEED);

    if (keys['Space'] && Date.now() - lastShotTime > FIRE_RATE) {
        shoot();
        lastShotTime = Date.now();
    }
}

function shoot() {
    const bulletGeo = new THREE.SphereGeometry(0.15, 6, 6);
    const bulletMat = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xffff00 });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    
    bullet.position.copy(player.position);
    bullet.position.y += 0.8;
    
    bullets.push(bullet);
    scene.add(bullet);
}

function spawnEnemy() {
    if (Math.random() < ENEMY_SPAWN_RATE) {
        const enemyGeo = new THREE.BoxGeometry(1, 1, 1);
        const enemyMat = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        const enemy = new THREE.Mesh(enemyGeo, enemyMat);
        
        enemy.position.set(
            (Math.random() - 0.5) * (camera.right * 2 - 1),
            camera.top,
            0
        );
        
        enemies.push(enemy);
        scene.add(enemy);
    }
}

function updateEntities() {
    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.position.y += BULLET_SPEED;
        if (bullet.position.y > camera.top) {
            scene.remove(bullet);
            bullets.splice(i, 1);
        }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.position.y -= ENEMY_SPEED;
        if (enemy.position.y < -camera.top) {
            scene.remove(enemy);
            enemies.splice(i, 1);
        }
    }
    
    // Update stars
    stars.forEach(star => {
        star.position.y -= 0.05;
        if (star.position.y < -WORLD_H) {
            star.position.y = WORLD_H;
        }
    });
}

function checkCollisions() {
    // Bullets vs Enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (bullets[i] && enemies[j] && bullets[i].position.distanceTo(enemies[j].position) < 0.7) {
                scene.remove(bullets[i]);
                scene.remove(enemies[j]);
                bullets.splice(i, 1);
                enemies.splice(j, 1);
                score += 10;
                break;
            }
        }
    }

    // Player vs Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i] && player.position.distanceTo(enemies[i].position) < 0.8) {
            scene.remove(enemies[i]);
            enemies.splice(i, 1);
            health -= PLAYER_DAMAGE;
            if (health <= 0) {
                health = 0;
                gameOver();
            }
        }
    }
}

function updateHUD() {
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('health').textContent = `Health: ${health}`;

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
        <span id="health">Health: ${health}</span><br>
        <span id="score">Score: ${score}</span>
    `;
}

function animate() {
    requestAnimationFrame(animate);

    if (isGameOver) {
        if (keys['Enter']) {
            resetGame();
        }
    } else {
        updatePlayer();
        spawnEnemy();
        updateEntities();
        checkCollisions();
        updateHUD();
    }

    renderer.render(scene, camera);
}

init();
})();
