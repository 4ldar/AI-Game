(function() {
// === Breakout 2D Game (Standalone, No HTML UI, H for Hint) ===

// Game Settings
const WORLD_W = 20;
const WORLD_H = 26;
const PADDLE_W = 3;
const PADDLE_H = 0.5;
const PADDLE_Y = -WORLD_H / 2 + 2;
const BALL_RADIUS = 0.25;
const BALL_SPEED_INIT = 0.25;
const LIVES_INIT = 3;
const BRICK_ROWS = 6;
const BRICK_COLS = 8;
const BRICK_H = 0.8;
const BRICK_W = (WORLD_W - 1) / BRICK_COLS - 0.2;
const BRICK_COLORS = [0xcc0000, 0xcc6600, 0xcccc00, 0x00cc00, 0x0066cc, 0x6600cc];

// Globals
let scene, camera, renderer;
let paddle, ball, bricks = [];
let ballVelocity;
let keys = {};
let score, lives, bricksRemaining;
let isGameActive = false;
let isGameOver = false;
let showHintOverlay = false;
let gameCanvasContainer;

//Overlay DOM
let overlayDiv = null;

function showHint() {
    if (overlayDiv) return;
    overlayDiv = document.createElement('div');
    overlayDiv.style.position = 'fixed';
    overlayDiv.style.top = 0;
    overlayDiv.style.left = 0;
    overlayDiv.style.width = '100vw';
    overlayDiv.style.height = '100vh';
    overlayDiv.style.background = 'rgba(0,0,40,0.97)';
    overlayDiv.style.zIndex = 9999;
    overlayDiv.style.display = 'flex';
    overlayDiv.style.alignItems = 'center';
    overlayDiv.style.justifyContent = 'center';
    overlayDiv.style.flexDirection = 'column';
    overlayDiv.style.fontFamily = 'Instrument Sans,Arial,sans-serif';
    overlayDiv.style.fontSize = '2em';
    overlayDiv.style.color = '#fff';
    overlayDiv.innerHTML = `
        <div style="text-align: center; max-width: 90vw; padding: 32px;">
            <div style="font-size:2.6em;font-weight:bold;margin-bottom:0.5em;">Breakout 2D</div>
            <div>
                <b>Petunjuk:</b><br>
                <span>Gerakkan mouse : Menggerakkan paddle</span><br>
                <span>Klik kiri : Melepaskan bola</span><br>
                <span>Tahan paddle untuk memantulkan<br>bola ke arah yang diinginkan</span><br><br>
                <span>Tekan <b>[ESC]</b> untuk menutup petunjuk ini.</span>
            </div>
        </div>
    `;
    document.body.appendChild(overlayDiv);
    showHintOverlay = true;
}

function hideHint() {
    if (overlayDiv) {
        overlayDiv.parentNode.removeChild(overlayDiv);
        overlayDiv = null;
    }
    showHintOverlay = false;
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000022);

    gameCanvasContainer = document.getElementById('game-canvas-container');
    const aspectRatio = gameCanvasContainer.offsetWidth / gameCanvasContainer.offsetHeight;

    camera = new THREE.OrthographicCamera(
        -WORLD_W / 2 * aspectRatio, WORLD_W / 2 * aspectRatio,
        WORLD_H / 2, -WORLD_H / 2,
        0.1, 100
    );
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(gameCanvasContainer.offsetWidth, gameCanvasContainer.offsetHeight);
    gameCanvasContainer.appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(light);
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(0, 0, 5);
    scene.add(pointLight);

    const paddleGeo = new THREE.BoxGeometry(PADDLE_W, PADDLE_H, 1);
    const paddleMat = new THREE.MeshStandardMaterial({ color: 0x00ccff });
    paddle = new THREE.Mesh(paddleGeo, paddleMat);
    scene.add(paddle);

    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    ball = new THREE.Mesh(ballGeo, ballMat);
    scene.add(ball);

    resetGame();

    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        // Handle 'H' for hint, and Escape to close overlay
        if (!showHintOverlay && (e.key === 'h' || e.key === 'H')) {
            showHint();
        } else if (showHintOverlay && (e.key === 'Escape' || e.key === 'Esc')) {
            hideHint();
        }
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', onWindowResize);

    animate();
}

function resetGame() {
    isGameOver = false;
    isGameActive = false;
    score = 0;
    lives = LIVES_INIT;
    
    // Remove all overlays/petunjuk
    hideHint();

    buildBricks();
    resetPaddleAndBall();
}

function buildBricks() {
    bricks.forEach(b => scene.remove(b));
    bricks = [];
    const startY = WORLD_H / 2 - 4;
    
    for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
            const brickGeo = new THREE.BoxGeometry(BRICK_W, BRICK_H, 1);
            const brickMat = new THREE.MeshStandardMaterial({ color: BRICK_COLORS[r % BRICK_COLORS.length] });
            const brick = new THREE.Mesh(brickGeo, brickMat);
            
            brick.position.x = (c - BRICK_COLS / 2 + 0.5) * (BRICK_W + 0.2);
            brick.position.y = startY - r * (BRICK_H + 0.2);
            
            bricks.push(brick);
            scene.add(brick);
        }
    }
    bricksRemaining = bricks.length;
}

function resetPaddleAndBall() {
    isGameActive = false;
    paddle.position.set(0, PADDLE_Y, 0);
    ball.position.set(0, PADDLE_Y + PADDLE_H / 2 + BALL_RADIUS, 0);
    ballVelocity = new THREE.Vector2(0, 0);
}

function launchBall() {
    if (isGameActive) return;
    isGameActive = true;
    ballVelocity.set(
        (Math.random() - 0.5) * 0.1,
        BALL_SPEED_INIT
    );
}

function onMouseMove(e) {
    if (showHintOverlay) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const paddleLimit = WORLD_W / 2 - PADDLE_W / 2;
    paddle.position.x = THREE.MathUtils.clamp(mouseX * (WORLD_W / 2), -paddleLimit, paddleLimit);
    if (!isGameActive) {
        ball.position.x = paddle.position.x;
    }
}

function onMouseDown(e) {
    if (showHintOverlay) return;
    if (isGameOver) return;
    launchBall();
}

function handleEndGame(isWin) {
    isGameOver = true;
    isGameActive = false;
    // Show fullscreen overlay for end game message
    if (overlayDiv) hideHint();
    overlayDiv = document.createElement('div');
    overlayDiv.style.position = 'fixed';
    overlayDiv.style.top = 0;
    overlayDiv.style.left = 0;
    overlayDiv.style.width = '100vw';
    overlayDiv.style.height = '100vh';
    overlayDiv.style.background = 'rgba(0,0,40,0.98)';
    overlayDiv.style.zIndex = 9999;
    overlayDiv.style.display = 'flex';
    overlayDiv.style.alignItems = 'center';
    overlayDiv.style.justifyContent = 'center';
    overlayDiv.style.flexDirection = 'column';
    overlayDiv.style.fontFamily = 'Instrument Sans,Arial,sans-serif';
    overlayDiv.style.fontSize = '2.5em';
    overlayDiv.style.color = '#fff';

    overlayDiv.innerHTML = `
        <div style="text-align: center; max-width: 90vw; padding: 38px;">
            <div style="font-size:2.8em;font-weight:bold;">
                ${isWin ? 'YOU WIN!' : 'GAME OVER'}
            </div>
            <div style="font-size:1em;margin:1em 0 1.3em 0;letter-spacing:0.04em;">Score: ${score}</div>
            <div style="font-size:1.1em;">Tekan <b>[ENTER]</b> untuk mengulang</div>
            <div style="font-size:1em; margin-top: 1.6em; color:#afc;opacity:0.7;">Tekan <b>[H]</b> untuk petunjuk / hint</div>
        </div>
    `;
    document.body.appendChild(overlayDiv);
    showHintOverlay = true;
}

function onWindowResize() {
    const newWidth = gameCanvasContainer.offsetWidth;
    const newHeight = gameCanvasContainer.offsetHeight;

    renderer.setSize(newWidth, newHeight);

    const aspectRatio = newWidth / newHeight;
    camera.left = -WORLD_W / 2 * aspectRatio;
    camera.right = WORLD_W / 2 * aspectRatio;
    camera.top = WORLD_H / 2;
    camera.bottom = -WORLD_H / 2;
    camera.updateProjectionMatrix();
}

function checkCollisions() {
    const ballBox = new THREE.Box3().setFromObject(ball);

    // Walls
    if (ball.position.x > WORLD_W / 2 - BALL_RADIUS || ball.position.x < -WORLD_W / 2 + BALL_RADIUS) {
        ballVelocity.x *= -1;
        ball.position.x = THREE.MathUtils.clamp(ball.position.x, -WORLD_W / 2 + BALL_RADIUS, WORLD_W / 2 + BALL_RADIUS);
    }
    if (ball.position.y > WORLD_H / 2 - BALL_RADIUS) {
        ballVelocity.y *= -1;
        ball.position.y = WORLD_H / 2 - BALL_RADIUS;
    }

    // Bottom (lose life)
    if (ball.position.y < -WORLD_H / 2) {
        lives--;
        if (lives <= 0) {
            handleEndGame(false);
        } else {
            resetPaddleAndBall();
        }
        return;
    }

    // Paddle
    const paddleBox = new THREE.Box3().setFromObject(paddle);
    if (ballVelocity.y < 0 && ballBox.intersectsBox(paddleBox)) {
        ballVelocity.y *= -1;
        const hitPos = (ball.position.x - paddle.position.x) / (PADDLE_W / 2);
        ballVelocity.x = THREE.MathUtils.clamp(hitPos, -1, 1) * BALL_SPEED_INIT;
        ball.position.y = paddle.position.y + PADDLE_H/2 + BALL_RADIUS; // prevent sticking
    }

    // Bricks
    for (let i = bricks.length - 1; i >= 0; i--) {
        const brick = bricks[i];
        const brickBox = new THREE.Box3().setFromObject(brick);
        if (ballBox.intersectsBox(brickBox)) {
            scene.remove(brick);
            bricks.splice(i, 1);
            score += 10;
            bricksRemaining--;

            const overlap = ballBox.clone().intersect(brickBox);
            const overlapSize = new THREE.Vector3();
            overlap.getSize(overlapSize);

            if (overlapSize.x < overlapSize.y) {
                ballVelocity.x *= -1;
                if (ball.position.x < brick.position.x)
                    ball.position.x = brickBox.min.x - BALL_RADIUS;
                else
                    ball.position.x = brickBox.max.x + BALL_RADIUS;
            } else {
                ballVelocity.y *= -1;
                if (ball.position.y < brick.position.y)
                    ball.position.y = brickBox.min.y - BALL_RADIUS;
                else
                    ball.position.y = brickBox.max.y + BALL_RADIUS;
            }
            
            if (bricksRemaining <= 0) {
                handleEndGame(true);
            }
            break;
        }
    }
}

function drawHUD() {
    // Nothing; no permanent HTML HUD used
    // For demonstration, the code can optionally draw overlays in canvas here, but per prompt, we'll skip permanent elements.
}

function animate() {
    requestAnimationFrame(animate);

    if (showHintOverlay) {
        // game paused if petunjuk/hint overlay or result overlay shown
        renderer.render(scene, camera);
        return;
    }

    if (isGameOver) {
        if (keys['Enter']) {
            keys['Enter'] = false;
            hideHint();
            resetGame();
        }
    } else if (isGameActive) {
        ball.position.x += ballVelocity.x;
        ball.position.y += ballVelocity.y;
        checkCollisions();
    }
    
    renderer.render(scene, camera);

    // Optionally, draw the HUD (score/lives) with a 2D overlay or WebGL
    // But per prompt, no permanent overlay; all info goes via hint/end overlays.
}

init();

})();