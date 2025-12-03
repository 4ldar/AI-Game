(function () {
    // Create HTML elements dynamically (scope limited inside IIFE)
    const container = document.createElement("div");
    container.id = "game-canvas-container";
    container.style.top = 0;
    container.style.left = 0;
    document.body.appendChild(container);

    // HUD
    const hud = document.createElement("div");
    hud.style.top = "10px";
    hud.style.left = "10px";
    hud.style.color = "white";
    hud.style.font = "20px Arial";
    hud.style.pointerEvents = "none";
    document.body.appendChild(hud);

    // Game Over Screen
    const gameoverDiv = document.createElement("div");
    gameoverDiv.style.top = 0;
    gameoverDiv.style.left = 0;
    gameoverDiv.style.display = "none";
    gameoverDiv.style.background = "rgba(0,0,0,0.7)";
    gameoverDiv.style.color = "white";
    gameoverDiv.style.font = "40px Arial";
    gameoverDiv.style.justifyContent = "center";
    gameoverDiv.style.alignItems = "center";
    gameoverDiv.style.flexDirection = "column";
    gameoverDiv.style.textAlign = "center";
    gameoverDiv.style.zIndex = 10;
    gameoverDiv.style.display = "flex";
    document.body.appendChild(gameoverDiv);

    const endMsg = document.createElement("div");
    endMsg.id = "end-message";
    gameoverDiv.appendChild(endMsg);

    const restartMsg = document.createElement("div");
    restartMsg.id = "restart-prompt";
    restartMsg.style.fontSize = "20px";
    restartMsg.style.marginTop = "10px";
    gameoverDiv.appendChild(restartMsg);

    // ===== Original Game Code (modified, now encapsulated) =====

    const GAME_CONST = {
        WORLD_WIDTH: 40,
        WORLD_HEIGHT: 30,
        PLAYER_SPEED: 0.01,
        PLAYER_TURN_SPEED: 0.05,
        PLAYER_FRICTION: 0.99,
        BULLET_SPEED: 0.3,
        BULLET_LIFETIME: 60,
        ASTEROID_COUNT_INIT: 5,
        ASTEROID_SPEED_MAX: 0.1,
        INVINCIBILITY_TIME: 120
    };

    function GameState() {
        // "private" state for the game
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;
        this.bullets = [];
        this.asteroids = [];
        this.keys = {};
        this.score = 0;
        this.lives = 3;
        this.isGameOver = false;
        this.lastShotTime = 0;
        this.playerInvincible = 0;
    }

    function init() {
        const state = new GameState();

        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x000000);

        state.camera = new THREE.OrthographicCamera(
            -GAME_CONST.WORLD_WIDTH / 2, GAME_CONST.WORLD_WIDTH / 2,
            GAME_CONST.WORLD_HEIGHT / 2, -GAME_CONST.WORLD_HEIGHT / 2,
            0.1, 100
        );
        state.camera.position.z = 10;
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(state.renderer.domElement);

        resetGame(state);

        window.addEventListener('keydown', e => { state.keys[e.code] = true; });
        window.addEventListener('keyup', e => { state.keys[e.code] = false; });
        window.addEventListener('resize', () => onResize(state));

        animate(state);
    }

    function resetGame(state) {
        state.bullets.forEach(b => state.scene.remove(b.mesh));
        state.asteroids.forEach(a => state.scene.remove(a.mesh));
        state.bullets = [];
        state.asteroids = [];

        state.score = 0;
        state.lives = 3;
        state.isGameOver = false;

        gameoverDiv.style.display = "none";

        if (!state.player) {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0.5);
            shape.lineTo(-0.3, -0.5);
            shape.lineTo(0.3, -0.5);
            shape.closePath();

            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });

            state.player = {
                mesh: new THREE.Mesh(geometry, material),
                velocity: new THREE.Vector2(0, 0)
            };
            state.scene.add(state.player.mesh);
        }

        state.player.mesh.position.set(0, 0, 0);
        state.player.mesh.rotation.z = 0;
        state.player.velocity.set(0, 0);
        state.playerInvincible = GAME_CONST.INVINCIBILITY_TIME;

        spawnAsteroids(state, GAME_CONST.ASTEROID_COUNT_INIT, 3);
        updateHUD(state);
    }

    function spawnAsteroids(state, count, size) {
        for (let i = 0; i < count; i++) {
            let position;
            do {
                position = new THREE.Vector2(
                    (Math.random() - 0.5) * GAME_CONST.WORLD_WIDTH,
                    (Math.random() - 0.5) * GAME_CONST.WORLD_HEIGHT
                );
            } while (position.length() < 5);

            createAsteroid(state, position, size);
        }
    }

    function createAsteroid(state, position, size) {
        if (size < 1) return;

        const geometry = new THREE.IcosahedronGeometry(size / 2, 0);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, 0);

        const asteroid = {
            mesh,
            velocity: new THREE.Vector2(
                (Math.random() - 0.5) * GAME_CONST.ASTEROID_SPEED_MAX * 2,
                (Math.random() - 0.5) * GAME_CONST.ASTEROID_SPEED_MAX * 2
            ),
            size
        };

        state.asteroids.push(asteroid);
        state.scene.add(mesh);
    }

    function onResize(state) {
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function updatePlayer(state) {
        if (state.playerInvincible > 0) {
            state.playerInvincible--;
            state.player.mesh.visible = (state.playerInvincible % 20 < 10);
        } else {
            state.player.mesh.visible = true;
        }

        if (state.keys['KeyA'] || state.keys['ArrowLeft']) state.player.mesh.rotation.z += GAME_CONST.PLAYER_TURN_SPEED;
        if (state.keys['KeyD'] || state.keys['ArrowRight']) state.player.mesh.rotation.z -= GAME_CONST.PLAYER_TURN_SPEED;

        if (state.keys['KeyW'] || state.keys['ArrowUp']) {
            const dir = new THREE.Vector2(
                -Math.sin(state.player.mesh.rotation.z),
                Math.cos(state.player.mesh.rotation.z)
            );
            state.player.velocity.add(dir.multiplyScalar(GAME_CONST.PLAYER_SPEED));
        }

        state.player.velocity.multiplyScalar(GAME_CONST.PLAYER_FRICTION);
        state.player.mesh.position.x += state.player.velocity.x;
        state.player.mesh.position.y += state.player.velocity.y;
        wrap(state.player.mesh.position, GAME_CONST);

        if (state.keys['Space'] && !state.isGameOver && Date.now() - state.lastShotTime > 250) {
            shoot(state);
            state.lastShotTime = Date.now();
        }
    }

    function shoot(state) {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xff00ff })
        );

        const dir = new THREE.Vector2(
            -Math.sin(state.player.mesh.rotation.z),
            Math.cos(state.player.mesh.rotation.z)
        );

        mesh.position.set(
            state.player.mesh.position.x + dir.x * 0.5,
            state.player.mesh.position.y + dir.y * 0.5,
            0
        );

        state.bullets.push({
            mesh,
            velocity: dir.multiplyScalar(GAME_CONST.BULLET_SPEED).add(state.player.velocity),
            lifetime: GAME_CONST.BULLET_LIFETIME
        });

        state.scene.add(mesh);
    }

    function updateBullets(state) {
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            b.mesh.position.x += b.velocity.x;
            b.mesh.position.y += b.velocity.y;
            b.lifetime--;
            wrap(b.mesh.position, GAME_CONST);

            if (b.lifetime <= 0) {
                state.scene.remove(b.mesh);
                state.bullets.splice(i, 1);
            }
        }
    }

    function updateAsteroids(state) {
        state.asteroids.forEach(a => {
            a.mesh.position.x += a.velocity.x;
            a.mesh.position.y += a.velocity.y;
            wrap(a.mesh.position, GAME_CONST);
        });
    }

    function checkCollisions(state) {
        // bullets vs asteroids
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            for (let j = state.asteroids.length - 1; j >= 0; j--) {
                const b = state.bullets[i];
                const a = state.asteroids[j];

                if (b.mesh.position.distanceTo(a.mesh.position) < a.size / 2 + 0.1) {
                    state.scene.remove(b.mesh);
                    state.bullets.splice(i, 1);
                    splitAsteroid(state, a, j);
                    state.score += Math.round(100 / a.size);
                    break;
                }
            }
        }

        // player vs asteroid
        if (state.playerInvincible <= 0) {
            for (let i = state.asteroids.length - 1; i >= 0; i--) {
                const a = state.asteroids[i];
                if (state.player.mesh.position.distanceTo(a.mesh.position) < a.size / 2 + 0.3) {
                    state.lives--;
                    splitAsteroid(state, a, i);
                    if (state.lives <= 0) {
                        state.isGameOver = true;
                        showGameOver();
                    } else {
                        state.player.mesh.position.set(0, 0, 0);
                        state.player.velocity.set(0, 0);
                        state.playerInvincible = GAME_CONST.INVINCIBILITY_TIME;
                    }
                    break;
                }
            }
        }
    }

    function splitAsteroid(state, a, index) {
        const pos = a.mesh.position.clone();
        const size = a.size;

        state.scene.remove(a.mesh);
        state.asteroids.splice(index, 1);

        if (size > 1.5) {
            createAsteroid(state, new THREE.Vector2(pos.x, pos.y), size / 2);
            createAsteroid(state, new THREE.Vector2(pos.x, pos.y), size / 2);
        }
    }

    function showGameOver() {
        endMsg.textContent = "GAME OVER";
        restartMsg.textContent = "Press [ENTER] to restart";
        gameoverDiv.style.display = "flex";
    }

    function updateHUD(state) {
        hud.innerHTML = `
            Score: ${state.score}<br>
            Lives: ${state.lives}
        `;
    }

    function animate(state) {
        requestAnimationFrame(() => animate(state));

        if (state.isGameOver) {
            if (state.keys["Enter"]) resetGame(state);
        } else {
            updatePlayer(state);
            updateBullets(state);
            updateAsteroids(state);
            checkCollisions(state);
            updateHUD(state);

            if (state.asteroids.length === 0) {
                spawnAsteroids(state, GAME_CONST.ASTEROID_COUNT_INIT + 2, 3);
            }
        }
        state.renderer.render(state.scene, state.camera);
    }

    function wrap(p, CONST) {
        if (p.x > CONST.WORLD_WIDTH / 2) p.x = -CONST.WORLD_WIDTH / 2;
        if (p.x < -CONST.WORLD_WIDTH / 2) p.x = CONST.WORLD_WIDTH / 2;
        if (p.y > CONST.WORLD_HEIGHT / 2) p.y = -CONST.WORLD_HEIGHT / 2;
        if (p.y < -CONST.WORLD_HEIGHT / 2) p.y = CONST.WORLD_HEIGHT / 2;
    }

    init();
})();
