(function() {
let scene, camera, renderer;
let playerPaddle, opponentPaddle, ball, net;
let scoreElement;
let ballVelocity;
let keys = {};
let playerScore = 0, opponentScore = 0;
let gameState = 'serve';
let servingPlayer = 'player';
let lastHitBy = null;
let bounces = 0;

const courtWidth = 10;
const courtHeight = 23;
const paddleWidth = 2;
const paddleHeight = 0.4;
const paddleDepth = 0.5;
const ballRadius = 0.15;
const playerSpeed = 0.2;
const gravity = new THREE.Vector3(0, -0.012, 0);

function init() {
    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    // UI Elements
    scoreElement = document.getElementById('pong-score');
    document.getElementById('info').innerHTML = '<b>3D Tennis</b><br>[A][D] or [←][→] to Move<br>[SPACE] to Serve';
    document.getElementById('game-stats').style.display = 'none';

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Court and Boundaries
    const courtGeometry = new THREE.PlaneGeometry(courtWidth, courtHeight);
    const courtMaterial = new THREE.MeshStandardMaterial({ color: 0x008800 });
    const court = new THREE.Mesh(courtGeometry, courtMaterial);
    court.rotation.x = -Math.PI / 2;
    court.receiveShadow = true;
    scene.add(court);

    // Net
    const netHeight = 0.5;
    const netGeometry = new THREE.BoxGeometry(courtWidth, netHeight, 0.1);
    const netMaterial = new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.8 });
    net = new THREE.Mesh(netGeometry, netMaterial);
    net.position.y = netHeight / 2;
    net.receiveShadow = true;
    scene.add(net);

    // Player Paddle
    const playerPaddleGeometry = new THREE.BoxGeometry(paddleWidth, paddleHeight, paddleDepth);
    const playerPaddleMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    playerPaddle = new THREE.Mesh(playerPaddleGeometry, playerPaddleMaterial);
    playerPaddle.position.set(0, paddleHeight / 2, courtHeight / 2 - 1);
    playerPaddle.castShadow = true;
    scene.add(playerPaddle);

    // Opponent Paddle
    opponentPaddle = playerPaddle.clone();
    opponentPaddle.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    opponentPaddle.position.z = -courtHeight / 2 + 1;
    scene.add(opponentPaddle);

    // Camera Position
    camera.position.set(0, 4, courtHeight / 2 + 3);
    camera.lookAt(0, 0, 0);

    // Ball
    const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;
    scene.add(ball);

    // Controls
    document.addEventListener('keydown', (event) => keys[event.key] = true);
    document.addEventListener('keyup', (event) => keys[event.key] = false);
    window.addEventListener('resize', onWindowResize);

    resetBall();
    updateScore();
    animate();
}

function resetBall() {
    bounces = 0;
    lastHitBy = null;
    ball.position.y = 1;
    ballVelocity.set(0, 0, 0);

    if (servingPlayer === 'player') {
        ball.position.x = playerPaddle.position.x;
        ball.position.z = playerPaddle.position.z - paddleDepth - ballRadius - 0.1;
        gameState = 'serve';
    } else {
        ball.position.x = opponentPaddle.position.x;
        ball.position.z = opponentPaddle.position.z + paddleDepth + ballRadius + 0.1;
        ballVelocity.set((Math.random() - 0.5) * 0.1, 0.2, 0.2);
        gameState = 'play';
    }
}

function updateScore() {
    scoreElement.innerText = `Player: ${playerScore} - Opponent: ${opponentScore}`;
}

function handlePointEnd(winner) {
    if (winner === 'player') {
        playerScore++;
        servingPlayer = 'player';
    } else {
        opponentScore++;
        servingPlayer = 'opponent';
    }
    updateScore();
    gameState = 'pointEnd';
    setTimeout(resetBall, 1500);
}

function movePlayer() {
    const halfCourt = courtWidth / 2;
    const halfPaddle = paddleWidth / 2;
    if (keys['ArrowLeft'] || keys['a']) {
        playerPaddle.position.x -= playerSpeed;
    }
    if (keys['ArrowRight'] || keys['d']) {
        playerPaddle.position.x += playerSpeed;
    }

    if (playerPaddle.position.x < -halfCourt + halfPaddle) {
        playerPaddle.position.x = -halfCourt + halfPaddle;
    }
    if (playerPaddle.position.x > halfCourt - halfPaddle) {
        playerPaddle.position.x = halfCourt - halfPaddle;
    }
    
    if (gameState === 'serve' && servingPlayer === 'player' && (keys[' '] || keys['Spacebar'])) {
        ballVelocity.set((Math.random() - 0.5) * 0.1, 0.2, -0.3);
        lastHitBy = 'player';
        bounces = 0;
        gameState = 'play';
    }
}

function updateAI() {
     const reactionSpeed = 0.08;
     const targetX = ball.position.z > 0 ? 0 : ball.position.x;
     opponentPaddle.position.x += (targetX - opponentPaddle.position.x) * reactionSpeed;
}

function handleCollisions() {
    const ballBox = new THREE.Box3().setFromObject(ball);
    const playerBox = new THREE.Box3().setFromObject(playerPaddle);
    const opponentBox = new THREE.Box3().setFromObject(opponentPaddle);
    const netBoundingBox = new THREE.Box3().setFromObject(net);

    if (ballBox.intersectsBox(playerBox) && ballVelocity.z < 0) {
        ballVelocity.z *= -1;
        ballVelocity.y = 0.22;
        lastHitBy = 'player';
        bounces = 0;
    }
    if (ballBox.intersectsBox(opponentBox) && ballVelocity.z > 0) {
        ballVelocity.z *= -1;
        ballVelocity.y = 0.2;
        lastHitBy = 'opponent';
        bounces = 0;
    }

    if (ball.position.y <= ballRadius) {
        ball.position.y = ballRadius;
        ballVelocity.y *= -0.8;
        bounces++;

        if (bounces > 1) {
            if (ball.position.z > 0) handlePointEnd('opponent');
            else handlePointEnd('player');
        }
    }

    if (ballBox.intersectsBox(netBoundingBox)) {
        if (lastHitBy === 'player') handlePointEnd('opponent');
        else handlePointEnd('player');
    }

    const halfCourtW = courtWidth / 2 + ballRadius;
    const halfCourtH = courtHeight / 2 + ballRadius;
    if (Math.abs(ball.position.x) > halfCourtW || Math.abs(ball.position.z) > halfCourtH) {
         if (gameState !== 'play') return;
         if (lastHitBy === 'player') handlePointEnd('opponent'); 
         else handlePointEnd('player');
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (gameState === 'play') {
        ballVelocity.add(gravity);
        ball.position.add(ballVelocity);
        handleCollisions();
    }

    movePlayer();
    updateAI();
    
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
})();