(function() {
const WORLD_W = 20, WORLD_H = 15;
const PADDLE_W = 0.5, PADDLE_H = 3;
const PADDLE_SPEED = 0.25, AI_PADDLE_SPEED = 0.15;
const BALL_RADIUS = 0.25, BALL_SPEED_INIT = 0.1, BALL_SPEED_INC = 0.008, BALL_SPEED_MAX = 0.37;
const MAX_SCORE = 10;

// --- Globals ---
let scene, camera, renderer;
let paddle1, paddle2, ball, net;
let ballVelocity;
let keys = {};
let score1 = 0, score2 = 0;
let isGameOver = false;

// --- Initialize Game ---
function init() {
    // Scene & Camera
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    camera = new THREE.OrthographicCamera(
        -WORLD_W/2, WORLD_W/2, WORLD_H/2, -WORLD_H/2, 0.1, 100
    );
    camera.position.z = 10;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    
    // Game Objects
    createObjects();

    document.getElementById('info').innerHTML = `
        <b>Pong 2D</b><br>
        <span>[W][S] : Move Paddle</span>
    `;

    // Event Listeners
    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);
    window.addEventListener('resize', onWindowResize);

    resetGame();
    animate();
}

// --- Create Paddles, Ball, Net ---
function createObjects() {
    const paddleGeo = new THREE.BoxGeometry(PADDLE_W, PADDLE_H, 1);
    const paddleMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    paddle1 = new THREE.Mesh(paddleGeo, paddleMat);
    paddle2 = new THREE.Mesh(paddleGeo, paddleMat);
    scene.add(paddle1, paddle2);

    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
    ball = new THREE.Mesh(ballGeo, paddleMat.clone());
    scene.add(ball);

    const netMat = new THREE.LineDashedMaterial({ color: 0x555555, dashSize: 0.5, gapSize: 0.25 });
    const netGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -WORLD_H/2, 0), new THREE.Vector3(0, WORLD_H/2, 0)
    ]);
    net = new THREE.Line(netGeo, netMat);
    net.computeLineDistances();
    scene.add(net);
}

// --- Reset Game/Score/Ball ---
function resetGame() {
    isGameOver = false;
    score1 = 0;
    score2 = 0;

    resetPositions();
    document.getElementById('gameover').style.display = 'none';
    resetBall();
    updateHUD();
}

function resetPositions() {
    paddle1.position.set(-WORLD_W / 2 + PADDLE_W, 0, 0);
    paddle2.position.set(WORLD_W / 2 - PADDLE_W, 0, 0);
}

// --- Ball Reset ---
function resetBall() {
    ball.position.set(0, 0, 0);
    let angle = (Math.random() * 0.7 - 0.35); // small random vertical
    let dir = Math.random() < 0.5 ? 1 : -1;
    ballVelocity = new THREE.Vector2(BALL_SPEED_INIT * dir, BALL_SPEED_INIT * angle);
}

// --- Handle Game Over ---
function gameOver() {
    isGameOver = true;
    const winner = score1 >= MAX_SCORE ? "Player 1" : "Player 2";
    const go = document.getElementById('gameover');
    go.querySelector('.winner').textContent = `${winner} Wins!`;
    go.querySelector('#restart-prompt').textContent = 'Press [ENTER] to restart';
    go.style.display = 'flex';
}

// --- Responsive Resize ---
function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const target = WORLD_W / WORLD_H;
    if (aspect > target) {
        camera.left = -WORLD_H / 2 * aspect;
        camera.right = WORLD_H / 2 * aspect;
        camera.top = WORLD_H / 2;
        camera.bottom = -WORLD_H / 2;
    } else {
        camera.left = -WORLD_W / 2;
        camera.right = WORLD_W / 2;
        camera.top = WORLD_W / 2 / aspect;
        camera.bottom = -WORLD_W / 2 / aspect;
    }
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Update Player & AI Paddles ---
function updatePaddles() {
    const minY = -WORLD_H / 2 + PADDLE_H / 2, maxY = WORLD_H / 2 - PADDLE_H / 2;

    // Player 1 (W, S, Up, Down)
    if (keys['KeyW'] || keys['ArrowUp'])   paddle1.position.y += PADDLE_SPEED;
    if (keys['KeyS'] || keys['ArrowDown']) paddle1.position.y -= PADDLE_SPEED;
    paddle1.position.y = THREE.MathUtils.clamp(paddle1.position.y, minY, maxY);

    // AI for Paddle 2
    const dy = ball.position.y - paddle2.position.y;
    if (Math.abs(dy) > 0.05)
        paddle2.position.y += Math.sign(dy) * Math.min(Math.abs(dy), AI_PADDLE_SPEED);

    paddle2.position.y = THREE.MathUtils.clamp(paddle2.position.y, minY, maxY);
}

// --- Update Ball Movement & Check Scores ---
function updateBall() {
    ball.position.x += ballVelocity.x;
    ball.position.y += ballVelocity.y;

    // Out left/right, update score and reset or end
    if (ball.position.x > WORLD_W / 2) {
        score1++;
        updateHUD();
        score1 >= MAX_SCORE ? gameOver() : resetBall();
    }
    if (ball.position.x < -WORLD_W / 2) {
        score2++;
        updateHUD();
        score2 >= MAX_SCORE ? gameOver() : resetBall();
    }
}

// --- Cap Ball Speed ---
function clampBallVelocity() {
    if (ballVelocity.length() > BALL_SPEED_MAX) ballVelocity.setLength(BALL_SPEED_MAX);
}

// --- Ball/Paddle/Wall Collisions ---
function checkCollisions() {
    const ballBox = new THREE.Box3().setFromObject(ball);
    const paddle1Box = new THREE.Box3().setFromObject(paddle1);
    const paddle2Box = new THREE.Box3().setFromObject(paddle2);

    // Top/Bottom wall collision
    if (
        ball.position.y > WORLD_H / 2 - BALL_RADIUS ||
        ball.position.y < -WORLD_H / 2 + BALL_RADIUS
    ) {
        ballVelocity.y *= -1;
        clampBallVelocity();
    }

    // Paddle 1 collision
    if (ballBox.intersectsBox(paddle1Box)) {
        ballVelocity.x = Math.abs(ballVelocity.x) + BALL_SPEED_INC;
        // Add spin by hit location
        const hitNorm = (ball.position.y - paddle1.position.y) / (PADDLE_H / 2);
        ballVelocity.y = hitNorm * ballVelocity.length() * 0.8;
        ball.position.x = paddle1.position.x + PADDLE_W / 2 + BALL_RADIUS + 0.01;
        clampBallVelocity();
    }
    // Paddle 2 collision
    if (ballBox.intersectsBox(paddle2Box)) {
        ballVelocity.x = -Math.abs(ballVelocity.x) - BALL_SPEED_INC;
        const hitNorm = (ball.position.y - paddle2.position.y) / (PADDLE_H / 2);
        ballVelocity.y = hitNorm * ballVelocity.length() * 0.8;
        ball.position.x = paddle2.position.x - PADDLE_W / 2 - BALL_RADIUS - 0.01;
        clampBallVelocity();
    }
}

// --- HUD Update ---
function updateHUD() {
    document.getElementById('pong-score').textContent = `${score1} - ${score2}`;
    document.getElementById('game-stats').style.display = 'none';
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (isGameOver) {
        if (keys['Enter']) resetGame();
    } else {
        updatePaddles();
        updateBall();
        checkCollisions();
    }
    renderer.render(scene, camera);
}

init();
})();