(function() {
const ACCELERATION = 0.002;
const BRAKE_FORCE = -0.003;
const FRICTION = 0.98;
const MAX_SPEED = 0.4;
const TRACK_LENGTH = 150;
const LANES = [-3, 0, 3];

// Globals
let scene, camera, renderer, clock;
let player, npcs = [];
let keys = {};
let gameState = 'waiting'; // waiting, countdown, racing, finished
let winner = null;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x446688);
    clock = new THREE.Clock();

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, 0.1, 200);
    camera.position.set(0, 5, 15);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(light);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(10, 10, 5);
    scene.add(dirLight);

    buildTrack();
    
    player = createCar(0x00ff00, LANES[1]);
    npcs.push(createCar(0xff0000, LANES[0]));
    npcs.push(createCar(0x00ffff, LANES[2]));
    npcs[0].userData.ai = { baseSpeed: 0.25 + Math.random() * 0.05, reaction: 0.1 };
    npcs[1].userData.ai = { baseSpeed: 0.28 + Math.random() * 0.05, reaction: 0.05 };

    document.getElementById('info').innerHTML = `
        <b>Side-Scroller Race</b><br>
        <span>[W]/[↑] : Accelerate</span><br>
        <span>[S]/[↓] : Brake</span>
    `;

    resetGame();

    window.addEventListener('keydown', e => { keys[e.code] = true; });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('resize', onWindowResize);
    
    animate();
}

function createCar(color, z) {
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 1), new THREE.MeshStandardMaterial({ color }));
    const carTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    carTop.position.y = 0.5;
    const car = new THREE.Group();
    car.add(carBody, carTop);
    car.position.z = z;
    car.userData = { velocity: 0 };
    scene.add(car);
    return car;
}

function buildTrack() {
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(TRACK_LENGTH + 40, 1, 12), groundMat);
    ground.position.y = -0.5;
    ground.position.x = TRACK_LENGTH / 2;
    scene.add(ground);
    
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    for(let i=0; i < TRACK_LENGTH / 4; i++) {
        const points = [
            new THREE.Vector3(i*4 - 10, 0, LANES[0] - 1.5),
            new THREE.Vector3(i*4 - 8, 0, LANES[0] - 1.5),
            new THREE.Vector3(i*4 - 10, 0, LANES[1] - 1.5),
            new THREE.Vector3(i*4 - 8, 0, LANES[1] - 1.5),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.LineSegments(geo, lineMat);
        scene.add(line);
    }
    
    const finishGeo = new THREE.BoxGeometry(0.2, 0.1, 10);
    const finishMat = new THREE.MeshStandardMaterial({color: 0xffffff});
    const finishLine = new THREE.Mesh(finishGeo, finishMat);
    finishLine.position.set(TRACK_LENGTH, 0, 0);
    scene.add(finishLine);
}

function resetGame() {
    gameState = 'countdown';
    winner = null;
    
    player.position.x = 0;
    player.userData.velocity = 0;
    npcs.forEach(npc => {
        npc.position.x = 0;
        npc.userData.velocity = 0;
    });
    
    document.getElementById('gameover').style.display = 'none';
    
    let count = 3;
    const countdownElem = document.getElementById('countdown');
    countdownElem.style.display = 'block';
    countdownElem.textContent = count;
    
    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownElem.textContent = count;
        } else {
            countdownElem.textContent = 'GO!';
            setTimeout(() => {
                countdownElem.style.display = 'none';
                gameState = 'racing';
            }, 500);
            clearInterval(countdownInterval);
        }
    }, 1000);
}

function updatePlayer() {
    if (keys['KeyW'] || keys['ArrowUp']) {
        player.userData.velocity += ACCELERATION;
    } else if (keys['KeyS'] || keys['ArrowDown']) {
        player.userData.velocity += BRAKE_FORCE;
    }
    
    player.userData.velocity *= FRICTION;
    player.userData.velocity = THREE.MathUtils.clamp(player.userData.velocity, 0, MAX_SPEED);
    player.position.x += player.userData.velocity;
}

function updateNPCs() {
    npcs.forEach(npc => {
        // Simple AI: try to maintain base speed with some randomness
        if (npc.userData.velocity < npc.userData.ai.baseSpeed) {
            npc.userData.velocity += ACCELERATION * (0.8 + Math.random() * 0.4);
        }
        if(Math.random() < npc.userData.ai.reaction) {
             npc.userData.velocity *= (0.95 + Math.random() * 0.1);
        }
        
        npc.userData.velocity *= FRICTION;
        npc.userData.velocity = THREE.MathUtils.clamp(npc.userData.velocity, 0, MAX_SPEED * 0.9);
        npc.position.x += npc.userData.velocity;
    });
}

function checkWinCondition() {
    if (player.position.x >= TRACK_LENGTH && !winner) winner = 'Player';
    if (npcs[0].position.x >= TRACK_LENGTH && !winner) winner = 'Red Car';
    if (npcs[1].position.x >= TRACK_LENGTH && !winner) winner = 'Blue Car';

    if (winner) {
        handleEndGame();
    }
}

function handleEndGame() {
    gameState = 'finished';
    const go = document.getElementById('gameover');
    go.querySelector('#end-message').textContent = `${winner} Wins!`;
    go.querySelector('#restart-prompt').textContent = 'Press [ENTER] to race again';
    go.style.display = 'flex';
}

function updateCamera() {
    camera.position.x += (player.position.x - camera.position.x) * 0.1;
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -10 * aspect;
    camera.right = 10 * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateHUD() {
    const speedKmh = (player.userData.velocity / MAX_SPEED * 200).toFixed(0);
    document.getElementById('score').textContent = `Speed: ${speedKmh} km/h`;
    document.getElementById('lives').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('phase').style.display = 'none';
    document.getElementById('pong-score').style.display = 'none';
}

function animate() {
    requestAnimationFrame(animate);
    
    switch(gameState) {
        case 'racing':
            updatePlayer();
            updateNPCs();
            checkWinCondition();
            updateCamera();
            updateHUD();
            break;
        case 'finished':
            if (keys['Enter']) resetGame();
            break;
    }
    
    renderer.render(scene, camera);
}

init();
})();