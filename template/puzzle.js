(function() {
const GRID_SIZE = 6;
const CAM_Y = 12;
const COLORS_BY_PHASE = [
    [0xff4d4d, 0x4dff7a, 0x4d7aff, 0xffd24d, 0xff4dd6, 0x4dfff0],
    [0x005fff, 0x00ffe7, 0x00bfff, 0x00ff9f, 0x009fff, 0x00eaff],
    [0x0077ff, 0x0099ff, 0x00bbff, 0x33ccff, 0x3399ff, 0x33bbff],
];
const PHASE_THRESHOLDS = [0, 200, 500, 1000];

// GLOBALS
let scene, camera, renderer, clock;
let grid = [];
let colorSet = COLORS_BY_PHASE[0];
let score = 0;
let phase = 1;
let gameState = 'idle'; // idle, animating, game_over
let selected = null; // selected cell for swapping

// UTIL: grid positions
const TILE_SIZE = 1;
const GAP = 0.2;
const getGridCoord = (i, size) => i * (TILE_SIZE + GAP) - (size - 1) * (TILE_SIZE + GAP) / 2;
const getGridX = (x) => getGridCoord(x, GRID_SIZE);
const getGridZ = (y) => getGridCoord(y, GRID_SIZE);

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    clock = new THREE.Clock();

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(-8*aspect, 8*aspect, 8, -8, 1, 100);
    camera.position.set(0, CAM_Y, 0);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const amb = new THREE.AmbientLight(0xffffff, 0.9);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 5);
    scene.add(amb, dir);

    document.getElementById('info').innerHTML = `
        <b>3D Match Puzzle</b><br>
        <span>Click a block, then click an adjacent block to swap.</span><br>
        <span>Match 3+ to score. Press [ENTER] to restart.</span>
    `;

    // soft floor plane for visual grounding
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    plane.rotation.x = -Math.PI/2;
    plane.position.y = -0.26;
    scene.add(plane);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    resetGame();
    animate();
}

function resetGame() {
    // clear
    for (let x = 0; x < grid.length; x++) {
        for (let y = 0; y < (grid[x]||[]).length; y++) {
            const c = grid[x][y];
            if (c && c.mesh) scene.remove(c.mesh);
        }
    }
    grid = [];
    score = 0;
    phase = 1;
    colorSet = COLORS_BY_PHASE[0];
    gameState = 'idle';
    selected = null;
    document.getElementById('gameover').style.display = 'none';

    // init grid data
    for (let x = 0; x < GRID_SIZE; x++) {
        grid[x] = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            grid[x][y] = { mesh: null, colorIndex: -1, x, y };
        }
    }

    fillGridPreventInstantMatches(() => {
        updateHUD();
        // ensure there's at least one possible move; if not, reshuffle
        if (!hasPossibleMoves()) reshuffleGrid();
    });
}

// create a cube mesh
function makeCube(color) {
    const geo = new THREE.BoxGeometry(TILE_SIZE, 0.5, TILE_SIZE);
    const mat = new THREE.MeshStandardMaterial({ color });
    return new THREE.Mesh(geo, mat);
}

function createCell(x, y, colorIndex) {
    const mesh = makeCube(colorSet[colorIndex]);
    mesh.position.set(getGridX(x), 0, getGridZ(y));
    scene.add(mesh);
    const cell = { mesh, colorIndex, x, y };
    mesh.userData.cell = cell;
    grid[x][y] = cell;
}

function fillGridPreventInstantMatches(cb) {
    // fill grid ensuring no immediate 3-in-row spawn
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            if (grid[x][y].mesh) continue;
            let attempts = 0;
            let colorIndex;
            do {
                colorIndex = Math.floor(Math.random() * colorSet.length);
                attempts++;
            } while (wouldCreateImmediateMatchOnSpawn(x, y, colorIndex) && attempts < 200);
            createCell(x, y, colorIndex);
        }
    }
    // small timeout to ensure meshes are in scene before callback
    setTimeout(cb||(()=>{}), 10);
}

function wouldCreateImmediateMatchOnSpawn(x, y, colorIndex) {
    // horizontal
    if (x >= 2) {
        if (grid[x-1][y].colorIndex === colorIndex && grid[x-2][y].colorIndex === colorIndex) return true;
    }
    // vertical
    if (y >= 2) {
        if (grid[x][y-1].colorIndex === colorIndex && grid[x][y-2].colorIndex === colorIndex) return true;
    }
    return false;
}

// --- MATCHING ---
function findMatches() {
    const matched = new Set();
    // horizontal
    for (let y = 0; y < GRID_SIZE; y++) {
        let runColor = null, runStart = 0, runLen = 0;
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = grid[x][y];
            if (!cell.mesh) { runColor = null; runLen = 0; continue; }
            if (cell.colorIndex === runColor) { runLen++; }
            else { if (runLen >= 3) for (let k = runStart; k < x; k++) matched.add(grid[k][y]); runColor = cell.colorIndex; runStart = x; runLen = 1; }
        }
        if (runLen >= 3) for (let k = runStart; k < GRID_SIZE; k++) matched.add(grid[k][y]);
    }
    // vertical
    for (let x = 0; x < GRID_SIZE; x++) {
        let runColor = null, runStart = 0, runLen = 0;
        for (let y = 0; y < GRID_SIZE; y++) {
            const cell = grid[x][y];
            if (!cell.mesh) { runColor = null; runLen = 0; continue; }
            if (cell.colorIndex === runColor) { runLen++; }
            else { if (runLen >= 3) for (let k = runStart; k < y; k++) matched.add(grid[x][k]); runColor = cell.colorIndex; runStart = y; runLen = 1; }
        }
        if (runLen >= 3) for (let k = runStart; k < GRID_SIZE; k++) matched.add(grid[x][k]);
    }
    return Array.from(matched);
}

function removeMatches(matches, awardPoints = true) {
    if (!matches || matches.length === 0) return Promise.resolve();
    gameState = 'animating';
    if (awardPoints) {
        score += matches.length * 10;
        updatePhase();
        showMessage(`+${matches.length*10}`, 700);
    }
    // animate scale down then remove
    return new Promise(resolve => {
        let finished = 0;
        matches.forEach(cell => {
            // guard
            if (!cell.mesh) { finished++; if (finished === matches.length) resolve(); return; }
            const m = cell.mesh;
            const animDur = 200 + Math.random()*200;
            const start = performance.now();
            (function tick(t) {
                const p = Math.min(1, (t - start) / animDur);
                const s = 1 - p;
                m.scale.setScalar(s);
                if (p < 1) requestAnimationFrame(tick);
                else {
                    // remove
                    scene.remove(m);
                    grid[cell.x][cell.y] = { mesh: null, colorIndex: -1, x: cell.x, y: cell.y };
                    finished++; if (finished === matches.length) resolve();
                }
            })(start);
        });
    }).then(() => {
        // after removal, drop and refill, then check for chains
        dropAndRefill().then(() => {
            const next = findMatches();
            if (next.length > 0) return removeMatches(next, true);
            // else finish
            gameState = 'idle';
            if (!hasPossibleMoves()) handleNoMoreMoves();
        });
    });
}

function dropAndRefill() {
    return new Promise(resolve => {
        // drop existing blocks down per column
        for (let x = 0; x < GRID_SIZE; x++) {
            let write = 0;
            for (let y = 0; y < GRID_SIZE; y++) {
                const cell = grid[x][y];
                if (cell.mesh) {
                    if (y !== write) {
                        grid[x][write] = cell;
                        cell.y = write;
                        // animate position (instant for simplicity)
                        cell.mesh.position.set(getGridX(x), 0, getGridZ(write));
                        grid[x][y] = { mesh: null, colorIndex: -1, x, y };
                    }
                    write++;
                }
            }
            // fill remaining with new cubes
            for (let y = write; y < GRID_SIZE; y++) {
                let colorIndex;
                let attempts = 0;
                do {
                    colorIndex = Math.floor(Math.random()*colorSet.length);
                    attempts++;
                } while (wouldCreateImmediateMatchOnSpawn(x,y,colorIndex) && attempts < 200);
                createCell(x, y, colorIndex);
            }
        }
        // tiny delay to let new meshes be present
        setTimeout(resolve, 120);
    });
}

// Check if swapping two adjacent cells would create a match
function canSwapMakeMatch(c1, c2) {
    if (!c1 || !c2) return false;
    // swap colors
    const a = c1.colorIndex, b = c2.colorIndex;
    c1.colorIndex = b; c2.colorIndex = a;
    const m = checkMatchAt(c1.x, c1.y) || checkMatchAt(c2.x, c2.y);
    // swap back
    c1.colorIndex = a; c2.colorIndex = b;
    return m;
}

function checkMatchAt(x, y) {
    const c = grid[x][y];
    if (!c || !c.mesh) return false;
    const color = c.colorIndex;
    // horizontal count
    let cnt = 1; let i = x-1; while (i>=0 && grid[i][y].mesh && grid[i][y].colorIndex===color) { cnt++; i--; }
    i = x+1; while (i<GRID_SIZE && grid[i][y].mesh && grid[i][y].colorIndex===color) { cnt++; i++; }
    if (cnt >= 3) return true;
    // vertical
    cnt = 1; i = y-1; while (i>=0 && grid[x][i].mesh && grid[x][i].colorIndex===color) { cnt++; i--; }
    i = y+1; while (i<GRID_SIZE && grid[x][i].mesh && grid[x][i].colorIndex===color) { cnt++; i++; }
    return cnt >= 3;
}

function hasPossibleMoves() {
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            const c = grid[x][y]; if (!c.mesh) continue;
            if (x < GRID_SIZE-1) { if (canSwapMakeMatch(c, grid[x+1][y])) return true; }
            if (y < GRID_SIZE-1) { if (canSwapMakeMatch(c, grid[x][y+1])) return true; }
        }
    }
    return false;
}

function reshuffleGrid() {
    // simple reshuffle: collect colors then randomly reassign, then refill meshes
    const colors = [];
    for (let x=0;x<GRID_SIZE;x++) for (let y=0;y<GRID_SIZE;y++) colors.push(grid[x][y].colorIndex);
    // remove all meshes
    for (let x=0;x<GRID_SIZE;x++) for (let y=0;y<GRID_SIZE;y++) if (grid[x][y].mesh) scene.remove(grid[x][y].mesh);
    // shuffle array
    for (let i = colors.length-1; i>0; i--) { const j = Math.floor(Math.random()*(i+1)); [colors[i], colors[j]] = [colors[j], colors[i]]; }
    // reassign
    let idx = 0;
    for (let x=0;x<GRID_SIZE;x++) for (let y=0;y<GRID_SIZE;y++) createCell(x,y,colors[idx++]);
    // ensure no instant matches; if still none moves, call again
    if (!hasPossibleMoves()) setTimeout(reshuffleGrid, 50);
}

// --- INPUT & INTERACTION ---
function onPointerDown(e) {
    if (gameState !== 'idle') return;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);
    const meshes = [];
    for (let x=0;x<GRID_SIZE;x++) for (let y=0;y<GRID_SIZE;y++) if (grid[x][y].mesh) meshes.push(grid[x][y].mesh);
    const it = ray.intersectObjects(meshes);
    if (!it || it.length === 0) return;
    const mesh = it[0].object;
    const cell = mesh.userData.cell;
    if (!selected) {
        // select this cell
        selected = cell;
        highlightCell(selected, true);
    } else {
        // if clicked same -> deselect
        if (cell === selected) { highlightCell(selected, false); selected = null; return; }
        // check adjacency
        const dx = Math.abs(cell.x - selected.x), dy = Math.abs(cell.y - selected.y);
        if (dx + dy === 1) {
            // attempt swap
            if (canSwapMakeMatch(selected, cell)) {
                performSwap(selected, cell);
            } else {
                // animate quick invalid feedback (shake)
                flashInvalid(selected, cell);
            }
            highlightCell(selected, false);
            selected = null;
        } else {
            // select new
            highlightCell(selected, false);
            selected = cell;
            highlightCell(selected, true);
        }
    }
}

function highlightCell(cell, on) {
    if (!cell || !cell.mesh) return;
    if (on) cell.mesh.scale.setScalar(1.15);
    else cell.mesh.scale.setScalar(1);
}

function flashInvalid(a, b) {
    const origA = a.mesh.position.clone();
    const origB = b.mesh.position.clone();
    const start = performance.now();
    const dur = 200;
    (function tick(t){
        const p = (t-start)/dur; if (p>1) { a.mesh.position.copy(origA); b.mesh.position.copy(origB); return; }
        const shake = Math.sin(p*10)*0.06;
        a.mesh.position.x = origA.x + (a.x<b.x? -shake : shake);
        b.mesh.position.x = origB.x + (a.x<b.x? shake : -shake);
        requestAnimationFrame(tick);
    })(start);
}

function performSwap(c1, c2) {
    // swap colors & meshes in grid
    gameState = 'animating';
    // swap grid references
    const x1 = c1.x, y1 = c1.y, x2 = c2.x, y2 = c2.y;
    // swap entries
    [grid[x1][y1], grid[x2][y2]] = [grid[x2][y2], grid[x1][y1]];
    // update coords
    grid[x1][y1].x = x1; grid[x1][y1].y = y1;
    grid[x2][y2].x = x2; grid[x2][y2].y = y2;
    // animate positions to new locations
    const m1 = grid[x1][y1].mesh, m2 = grid[x2][y2].mesh;
    const p1 = new THREE.Vector3(getGridX(x1), 0, getGridZ(y1));
    const p2 = new THREE.Vector3(getGridX(x2), 0, getGridZ(y2));
    const start = performance.now(); const dur = 180;
    (function tick(t){
        const p = Math.min(1, (t-start)/dur);
        m1.position.lerpVectors(m1.position, p1, p);
        m2.position.lerpVectors(m2.position, p2, p);
        if (p < 1) requestAnimationFrame(tick);
        else {
            // after swap, find matches and process
            const matches = findMatches();
            if (matches.length > 0) {
                removeMatches(matches, true);
            } else {
                // no match (shouldn't happen because we checked canSwapMakeMatch) -> swap back
                setTimeout(() => {
                    // swap back quietly
                    [grid[x1][y1], grid[x2][y2]] = [grid[x2][y2], grid[x1][y1]];
                    grid[x1][y1].x = x1; grid[x1][y1].y = y1; grid[x2][y2].x = x2; grid[x2][y2].y = y2;
                    // animate back
                    const s = performance.now(); const d2 = 120;
                    (function tick2(t2){
                        const q = Math.min(1, (t2-s)/d2);
                        m1.position.lerpVectors(m1.position, new THREE.Vector3(getGridX(x2),0,getGridZ(y2)), 1-q);
                        m2.position.lerpVectors(m2.position, new THREE.Vector3(getGridX(x1),0,getGridZ(y1)), 1-q);
                        if (q < 1) requestAnimationFrame(tick2);
                        else { gameState = 'idle'; }
                    }) (s);
                }, 100);
            }
        }
    })(start);
}

// KEY HANDLERS
function onKeyDown(e) {
    if (gameState === 'game_over' && e.code === 'Enter') resetGame();
    if (e.code === 'KeyR') resetGame();
}

function handleNoMoreMoves() {
    gameState = 'game_over';
    document.getElementById('end-message').textContent = 'NO MORE MOVES';
    document.getElementById('end-score').textContent = `Final Score: ${score}`;
    document.getElementById('gameover').style.display = 'flex';
}

// PHASE & HUD
function updatePhase() {
    let newPhase = 1;
    for (let i = PHASE_THRESHOLDS.length-1; i>=0; i--) {
        if (score >= PHASE_THRESHOLDS[i]) { newPhase = i+1; break; }
    }
    newPhase = Math.min(newPhase, COLORS_BY_PHASE.length);
    if (newPhase !== phase) {
        phase = newPhase;
        colorSet = COLORS_BY_PHASE[Math.max(0, phase-1)];
        // recolor all existing cubes to the new palette in a stable way
        for (let x=0;x<GRID_SIZE;x++) for (let y=0;y<GRID_SIZE;y++) if (grid[x][y].mesh) {
            const ci = grid[x][y].colorIndex % colorSet.length;
            grid[x][y].mesh.material.color.setHex(colorSet[ci]);
        }
        showMessage(`Phase ${phase}!`, 900);
    }
    updateHUD();
}

function updateHUD() {
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('phase').textContent = `Phase: ${phase}`;
    document.getElementById('lives').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
}

function showMessage(text, duration) {
    const d = document.getElementById('message');
    d.textContent = text; d.style.display = 'block';
    if (duration) setTimeout(() => d.style.display = 'none', duration);
}

// RESIZE & ANIMATE
function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -8*aspect; camera.right = 8*aspect; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    updateHUD();
    renderer.render(scene, camera);
}

// start
init();
})();