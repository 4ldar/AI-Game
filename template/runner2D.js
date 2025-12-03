(function() {
// === Google T-Rex Chrome Dino Game (3D, simple) ===

// Settings
const GRAVITY = -0.035;
const JUMP_FORCE = 0.82;
const PLAYER_X_POS = -8.5;
const GROUND_Y = -4.0;
const GROUND_HEIGHT = 1;
const INITIAL_GAME_SPEED = 0.16;
const GAME_SPEED_ACCEL = 0.00007;
const OBSTACLE_SPAWN_RATE = 0.028;
const MIN_OBSTACLE_DIST = 6;
const MAX_OBSTACLE_DIST = 14;
const CLOUD_SPAWN_RATE = 0.007;

// Globals
let scene, camera, renderer;
let player, ground, clouds = [];
let entities = []; // obstacles
let keys = {};
let score;
let gameSpeed;
let isGameOver = false;
let nextObstacleX = 13;

function createTrexGeometry() {
    // Make a simple blocky Trex with head/body/leg
    const group = new THREE.Group();
    // Body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.6, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x959393 })
    );
    body.position.set(0, 0.38, 0);
    group.add(body);
    // Head
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.3, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xb4b4b4 })
    );
    head.position.set(0.35, 0.68, 0);
    group.add(head);
    // Leg 1
    const leg1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.25, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x726f6f })
    );
    leg1.position.set(0.19, 0.07, 0.12);
    group.add(leg1);
    // Leg 2
    const leg2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.22, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x726f6f })
    );
    leg2.position.set(-0.13, 0.05, -0.1);
    group.add(leg2);
    // Tail
    const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.18, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xb4b4b4 })
    );
    tail.position.set(-0.47, 0.32, 0);
    group.add(tail);
    // Eye
    const eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x222 })
    );
    eye.position.set(0.5, 0.76, 0.15);
    group.add(eye);
    return group;
}

function createCactusGeometry() {
    // Single and double-branch random cactuses
    const typ = Math.random() < 0.55 ? 1 : 2;
    const group = new THREE.Group();
    // Main trunk
    const trunkHeight = 0.75 + Math.random() * (typ === 2 ? 1.1 : 0.5);
    const trunk = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, trunkHeight, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x47bd51 })
    );
    trunk.position.set(0, trunkHeight/2, 0);
    group.add(trunk);
    if (typ === 2) {
        // Branches (left/right)
        for (let i=0; i<2; ++i) {
            const branch = new THREE.Mesh(
                new THREE.BoxGeometry(0.09, 0.38+Math.random()*0.23, 0.09),
                new THREE.MeshStandardMaterial({ color: 0x33963a })
            );
            branch.position.set(i===0 ? -0.16 : 0.16, trunkHeight - 0.22, 0);
            group.add(branch);
        }
    }
    return group;
}

function createCloudGeometry() {
    // Simple cloud (overlapping white ellipsoids)
    const group = new THREE.Group();
    for(let i=0; i<3; ++i){
        const cloudlet = new THREE.Mesh(
            new THREE.SphereGeometry(0.4 + 0.2*Math.random(), 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
        );
        cloudlet.position.set(i*0.55, 0, (Math.random()-0.5)*0.2);
        group.add(cloudlet);
    }
    return group;
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f7f7);

    // Camera
    camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 100);
    camera.position.z = 10;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setClearColor(0xf7f7f7);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    // Light
    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    let dl = new THREE.DirectionalLight(0xffffff, 0.17);
    dl.position.set(8, 20, 10);
    scene.add(dl);

    // Ground
    const groundGeo = new THREE.BoxGeometry(100, GROUND_HEIGHT, 1);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xd1d1d1 });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = GROUND_Y - (GROUND_HEIGHT/2);
    scene.add(ground);

    // Dotted line(s)
    for (let i = -11; i<=13; i+=2.2) {
        const dotGeo = new THREE.BoxGeometry(1.2, 0.08, 0.08);
        const dotMat = new THREE.MeshStandardMaterial({ color: 0xbababa });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(i, GROUND_Y+0.28, 0);
        scene.add(dot);
    }

    // Player
    player = createTrexGeometry();
    player.position.set(PLAYER_X_POS, GROUND_Y, 0);
    player.userData = {
        velocity: new THREE.Vector2(0,0),
        isOnGround: true
    };
    scene.add(player);

    // Clouds container
    clouds = [];

    document.getElementById('info').innerHTML = `
        <b>Google T-Rex</b><br>
        <span>[SPACE] / [↑] : Jump</span>
    `;

    resetGame();

    window.addEventListener('keydown', e => { keys[e.code] = true; });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('resize', onWindowResize);

    animate();
}

function resetGame() {
    isGameOver = false;
    score = 0;
    gameSpeed = INITIAL_GAME_SPEED;
    nextObstacleX = 13;

    player.position.set(PLAYER_X_POS, GROUND_Y, 0);
    player.userData.velocity.set(0,0);
    player.userData.isOnGround = true;

    // Remove obstacles
    entities.forEach(e => scene.remove(e));
    entities = [];

    // Remove cloud meshes
    clouds.forEach(cloud=> scene.remove(cloud.mesh));
    clouds = [];

    updateHUD();
    document.getElementById('gameover').style.display = 'none';
}

function spawnObstacle() {
    const cactus = createCactusGeometry();
    // Place at a set X, y above ground
    let baseY = GROUND_Y + 0.01;
    cactus.position.set(nextObstacleX, baseY, 0);
    cactus.userData.type = "obstacle";
    // For bounds
    cactus.userData.box = new THREE.Box3().setFromObject(cactus);
    entities.push(cactus);
    scene.add(cactus);
    // Plan next cactus X spacing
    nextObstacleX += MIN_OBSTACLE_DIST + Math.random()*(MAX_OBSTACLE_DIST-MIN_OBSTACLE_DIST);
}

function spawnCloud(){
    const c = {
        mesh: createCloudGeometry(),
        speed: 0.035 + Math.random()*0.07,
    };
    c.mesh.position.set(
        14+Math.random()*4,
        3 + (Math.random()*3),
        -2-Math.random()
    );
    scene.add(c.mesh);
    clouds.push(c);
}

function updatePlayer() {
    // Gravity
    player.userData.velocity.y += GRAVITY;
    player.position.y += player.userData.velocity.y;

    // Land
    if (player.position.y <= GROUND_Y) {
        player.position.y = GROUND_Y;
        player.userData.velocity.y = 0;
        player.userData.isOnGround = true;
    }

    // Jump
    let jump = (keys['Space'] || keys['ArrowUp']);
    if(jump && player.userData.isOnGround) {
        player.userData.velocity.y = JUMP_FORCE;
        player.userData.isOnGround = false;
    }
}

function spawnEntities(){
    // Spawns obstacles
    if (Math.random() < OBSTACLE_SPAWN_RATE && entities.length < 5) {
        spawnObstacle();
    }

    // Spawns clouds
    if (Math.random() < CLOUD_SPAWN_RATE && clouds.length < 5) {
        spawnCloud();
    }
}

function updateWorld() {
    gameSpeed += GAME_SPEED_ACCEL;
    score += Math.round(gameSpeed * 10);

    // Move obstacles, remove off-screen
    for(let i=entities.length-1; i>=0; i--){
        const ent = entities[i];
        ent.position.x -= gameSpeed;

        if (ent.position.x < -15) {
            scene.remove(ent);
            entities.splice(i, 1);
        }
    }

    // Move clouds, remove off-screen
    for(let i=clouds.length-1; i>=0; i--){
        const cloud = clouds[i];
        cloud.mesh.position.x -= cloud.speed;
        if(cloud.mesh.position.x < -20){
            scene.remove(cloud.mesh);
            clouds.splice(i, 1);
        }
    }
}

function handleCollisions() {
    const playerBox = new THREE.Box3().setFromObject(player);

    for (let i = entities.length - 1; i >= 0; i--) {
        const entity = entities[i];
        const entityBox = new THREE.Box3().setFromObject(entity);

        if (playerBox.intersectsBox(entityBox)) {
            if (entity.userData.type === 'obstacle') {
                handleEndGame();
                return;
            } else if (entity.userData.type === 'coin') {
                score += 500;
                scene.remove(entity);
                entities.splice(i, 1);
            }
        }
    }
}

function handleEndGame() {
    isGameOver = true;
    const go = document.getElementById('gameover');
    document.getElementById('end-message').textContent = 'GAME OVER';
    document.getElementById('end-score').textContent = `Final Score: ${score}`;
    document.getElementById('restart-prompt').textContent = 'Press [ENTER] to restart';
    go.style.display = 'flex';
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -12 * aspect;
    camera.right = 12 * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateHUD() {
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('lives').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('phase').style.display = 'none';
    document.getElementById('pong-score').style.display = 'none';
}

function animate() {
    requestAnimationFrame(animate);
    
    if (isGameOver) {
        if(keys['Enter']) resetGame();
    } else {
        updatePlayer();
        spawnEntities();
        updateWorld();
        handleCollisions();
        updateHUD();
    }
    
    renderer.render(scene, camera);
}

init();
})();
