(function() {
// --- BASIC SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-canvas-container').appendChild(renderer.domElement);

const clock = new THREE.Clock();

// LIGHTS
const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// GROUND / ROAD
const roadGroup = new THREE.Group();
scene.add(roadGroup);
function makeRoad(length = 600) {
  const roadMat = new THREE.MeshStandardMaterial({color:0x333333});
  const roadGeo = new THREE.PlaneBufferGeometry(8, length, 1, 1);
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI/2;
  road.position.z = -length/2 + 10;
  road.receiveShadow = true;
  roadGroup.add(road);
}
makeRoad(800);

// simple roadside
function makeSidewalk() {
  const g = new THREE.PlaneBufferGeometry(20, 800);
  const m = new THREE.MeshStandardMaterial({color:0x226622});
  const left = new THREE.Mesh(g, m);
  left.rotation.x = -Math.PI/2; left.position.x = -12; left.position.z = -390;
  const right = left.clone(); right.position.x = 12;
  roadGroup.add(left, right);
}

// --- CAR (box fallback + optional glb) ---
let car = null;
const carRoot = new THREE.Group();
scene.add(carRoot);
// fallback box mesh
const carBoxGeo = new THREE.BoxBufferGeometry(1.6, 0.6, 3);
const carMat = new THREE.MeshStandardMaterial({color: 0xff4444});
const carMesh = new THREE.Mesh(carBoxGeo, carMat);
carMesh.castShadow = true; carMesh.receiveShadow = true;
carRoot.add(carMesh);
car = carRoot; // safe to use immediately
car.position.set(0, 0.3, 10); // start area near +z

// try to load GLB model and replace fallback when ready
const loader = new THREE.GLTFLoader();
loader.load('f1.glb', (gltf)=>{
  try {
    const model = gltf.scene;
    model.traverse(c=>{ if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    model.scale.set(1,1,1);
    model.position.copy(car.position);
    model.rotation.copy(car.rotation);
    scene.remove(carRoot);
    scene.add(model);
    car = model;
    console.log('GLB loaded, using model');
  } catch(e){ console.warn('Failed to swap GLB:', e); }
}, undefined, (err)=>{ console.warn('GLTF load error:', err); });

// --- PARAMETERS (UI-bound) ---
const params = {
  maxSpeed: parseFloat(document.getElementById('speed').value),
  accel: parseFloat(document.getElementById('accel').value),
  turnSpeed: parseFloat(document.getElementById('turn').value),
  steerAssist: parseFloat(document.getElementById('steer').value),
  camLag: parseFloat(document.getElementById('cam').value)
};
// UI wiring
['speed','accel','turn','steer','cam'].forEach(id=>{
  const el = document.getElementById(id);
  el.addEventListener('input', ()=>{
    const v = parseFloat(el.value);
    if(id==='speed'){ params.maxSpeed = v; document.getElementById('lblSpeed').textContent = v.toFixed(2); }
    if(id==='accel'){ params.accel = v; document.getElementById('lblAccel').textContent = v.toFixed(3); }
    if(id==='turn'){ params.turnSpeed = v; document.getElementById('lblTurn').textContent = v.toFixed(3); }
    if(id==='steer'){ params.steerAssist = v; document.getElementById('lblSteer').textContent = v.toFixed(2); }
    if(id==='cam'){ params.camLag = v; document.getElementById('lblCam').textContent = v.toFixed(2); }
  });
});
// skin color
document.getElementById('skin').addEventListener('input', (e)=>{
  carMesh.material.color.set(e.target.value);
});
// reset pos
document.getElementById('resetBtn').addEventListener('click', ()=>{
  resetCar();
});

// --- MOVEMENT STATE ---
const input = {front:false, back:false, left:false, right:false};
window.addEventListener('keydown', (e)=>{
  const k = e.key.toLowerCase();
  if(k==='w'||e.key==='ArrowUp') input.front = true;
  if(k==='a'||e.key==='ArrowLeft') input.left = true;
  if(k==='d'||e.key==='ArrowRight') input.right = true;
});
window.addEventListener('keyup', (e)=>{
  const k = e.key.toLowerCase();
  if(k==='w'||e.key==='arrowup') input.front = false;
  if(k==='a'||e.key==='arrowleft') input.left = false;
  if(k==='d'||e.key==='arrowright') input.right = false;
});

// physics-ish
let velocity = 0; // positive forward (towards -Z in our setup)
const friction = 0.01;

// --- COLLISION: boxed walls and spatial grid ---
const walls = []; // {mesh, box}
const BOX_A = new THREE.Box3();
const BOX_B = new THREE.Box3();

// spatial grid: simple hash by cell
const grid = new Map();
const CELL = 12; // cell size
function cellKey(x,z){ const xi = Math.floor(x/CELL); const zi = Math.floor(z/CELL); return xi+','+zi; }
function addToGrid(wall){ const b = wall.box; const min = b.min, max = b.max; const x0=Math.floor(min.x/CELL), x1=Math.floor(max.x/CELL); const z0=Math.floor(min.z/CELL), z1=Math.floor(max.z/CELL);
  for(let xi=x0; xi<=x1; xi++){ for(let zi=z0; zi<=z1; zi++){ const k = xi+','+zi; if(!grid.has(k)) grid.set(k,[]); grid.get(k).push(wall); } }
}

function makeWall(x, y, z, w, h, d, color = 0x3333ff, rotationY = 0) {
  const geo = new THREE.BoxBufferGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = rotationY; // rotasi dulu baru hitbox
  scene.add(m);

  // hitbox sesuai rotasi
  const b = new THREE.Box3().setFromObject(m);
  walls.push({ mesh: m, box: b });
  addToGrid({ mesh: m, box: b });

  // buat helper setelah rotasi diterapkan
  const boxHelper = new THREE.Box3Helper(b.clone(), 0xffff00);
  scene.add(boxHelper);

  return m;
}



// create a track with many walls, sharp turns
(function buildTrack() {
  // lurus awal
  for (let i = 0; i < 10; i++) {
    makeWall(25, 0.25, -i * 10 - 20, 1, 1, 8, 0x4444aa);
    makeWall(-25, 0.25, -i * 10 - 20, 1, 1, 8, 0x4444aa);
  }

  let z = -120;

  function randomSegmentDefs() {
    const segs = [];
    const numSegments = 41 + Math.floor(Math.random() * 6);
    for (let i = 0; i < numSegments; i++) {
      const count = 5 + Math.floor(Math.random() * 26);
      const offsetPerSeg = (0.3 + Math.random() * 0.8) * 10;
      const dir = Math.random() < 0.5 ? 1 : -1;
      segs.push([count, offsetPerSeg, dir]);
    }
    return segs;
  }

  const segmentDefs = randomSegmentDefs();
  let offset = 0;
  let lastOffset = 0;

  // Track the last z and offset for finish block placement
  let lastZ = z;
  let lastOffsetForFinish = 0;

  for (const [count, perSeg, dir] of segmentDefs) { 
    for (let i = 0; i < count; i++) {
      offset += perSeg * dir ;

      // hitung arah jalur
      const dx = offset - lastOffset;
      const dz = -15; // tiap step maju ke -Z
      const angle = Math.atan2(dx, dz); // sudut relatif

      makeWall(28 + offset, 0.25, z, 1, 1, 2, 0x3355aa, angle);
      makeWall(-28 + offset, 0.25, z, 1, 1, 2, 0x3355aa, angle);

      lastOffset = offset;
      lastZ = z;
      lastOffsetForFinish = offset;
      z -= 15 + Math.random() * 2;
    }
  }

  // start/finish
  const startGate = makeWall(0, 0.25, 14, 16, 1, 1, 0x00ff00);
  // Tempatkan finish block di akhir lintasan (mengikuti offset & z terakhir)
  const finishGate = makeWall(lastOffsetForFinish, 0.25, lastZ, 3, 1, 1, 0xff0000);
  startGate.name = 'start';
  finishGate.name = 'finish';
})();


// --- START/FINISH detection & scoring ---
let started = false;
let finished = false;
let score = 0;
let bestOffset = 0;
let lastProgress = 0; // 0..1
const startZ = 10; const finishZ = -520; const totalDist = Math.abs(finishZ - startZ);

function calcProgress(z){ return Math.max(0, Math.min(1, Math.abs(z - startZ)/totalDist)); }

// --- CAMERA FOLLOW & smoothing ---
const camOffset = new THREE.Vector3(0, 3.2, 6.5);
const camTarget = new THREE.Vector3();

function updateCamera(delta){
  if(!car) return;
  // world offset behind car
  const matrix = car.matrixWorld;
  const worldOffset = camOffset.clone().applyMatrix4(matrix);
  // lerp using a factor influenced by delta and camLag
  const factor = 1 - Math.pow(1 - params.camLag, delta*60);
  camera.position.lerp(worldOffset, factor);
  // soft target ahead of car based on velocity (steer assist makes look-ahead)
  const forward = new THREE.Vector3(0,0,-1).applyQuaternion(car.quaternion);
  camTarget.copy(car.position).add(forward.multiplyScalar(4 + Math.abs(velocity)*10 * params.steerAssist));
  camera.lookAt(camTarget);
}

// --- COLLISION RESOLVE (optimized & stable-ish) ---
const pushVec = new THREE.Vector3();
function resolveCollisions() {
  // compute car box once
  BOX_A.setFromObject(car);
  // find candidate walls via grid
  const cx = Math.floor(BOX_A.getCenter(new THREE.Vector3()).x / CELL);
  const cz = Math.floor(BOX_A.getCenter(new THREE.Vector3()).z / CELL);
  const candidates = new Set();
  for(let ox=-1; ox<=1; ox++){
    for(let oz=-1; oz<=1; oz++){
      const k = (cx+ox)+','+(cz+oz);
      const list = grid.get(k);
      if(list) for(const w of list) candidates.add(w);
    }
  }
  for(const w of candidates){
    BOX_B.copy(w.box);
    if(BOX_A.intersectsBox(BOX_B)){
      // compute overlap on axes
      const overlapX = Math.min(BOX_A.max.x - BOX_B.min.x, BOX_B.max.x - BOX_A.min.x);
      const overlapZ = Math.min(BOX_A.max.z - BOX_B.min.z, BOX_B.max.z - BOX_A.min.z);
      // small epsilon to avoid jitter
      const eps = 0.02;
      if(overlapX > eps && overlapZ > eps){
        if(overlapX < overlapZ){
          // push on x
          const cx = BOX_A.getCenter(new THREE.Vector3()).x;
          const wx = BOX_B.getCenter(new THREE.Vector3()).x;
          const sign = (cx < wx) ? -1 : 1;
          car.position.x += sign * (overlapX + eps);
        } else {
          const cz2 = BOX_A.getCenter(new THREE.Vector3()).z;
          const wz = BOX_B.getCenter(new THREE.Vector3()).z;
          const sign = (cz2 < wz) ? -1 : 1;
          car.position.z += sign * (overlapZ + eps);
        }
        // damp velocity on collision
        velocity *= -0.25;
        // update car matrix for next checks
        car.updateMatrixWorld(true);
        BOX_A.setFromObject(car);
      }
    }
  }
}

// --- UPDATE CAR (movement + steering) ---
function updateCar(delta){
  if(!car) return;
  // control accel
  if(input.front){ velocity -= params.accel * delta * 60; started = true; }
  else if(input.back){ velocity += params.accel * 0.7 * delta * 60; }
  else {
    // friction
    velocity += (velocity > 0) ? -friction * delta * 60 : friction * delta * 60;
    if(Math.abs(velocity) < 0.0005) velocity = 0;
  }
  // clamp speed
  velocity = Math.max(-params.maxSpeed, Math.min(params.maxSpeed, velocity));

  // steering: reduce effective turn when slower and add steer assist
  const speedFactor = Math.min(1, Math.abs(velocity) / params.maxSpeed);
  const steer = params.turnSpeed * (0.5 + 0.5*speedFactor);
  if(Math.abs(velocity) > 0.0001){
    if(input.left){ car.rotation.y -= steer * delta * 60 * (velocity>0?1:-1); }
    if(input.right){ car.rotation.y += steer * delta * 60 * (velocity>0?1:-1); }
  }
  // translate forward in local Z (forward is -Z)
  car.translateZ(velocity * delta * 60);

  // simple clamp on Y
  if(car.position.y < 0.1) car.position.y = 0.1;

  // collision resolution (broadphase grid + narrow phase)
  resolveCollisions();

  // progress & scoring
  const prog = calcProgress(car.position.z);
  // increase score when progress increases; give more points for staying near center (offset score)
  if(prog > lastProgress){
    const deltaProg = prog - lastProgress;
    const centerOffset = Math.abs(car.position.x); // 0 = center
    const offsetScore = Math.max(0, 1 - (centerOffset / 8));
    const gained = deltaProg * 1000 * offsetScore;
    score += gained;
    if(offsetScore > bestOffset) bestOffset = offsetScore;
  }
  lastProgress = prog;

  // detect finish crossing
  if(!finished && car.position.z <= finishZ + 1){ finished = true; console.log('Finished! Score:', Math.round(score)); }
}

function resetCar(){
  velocity = 0; car.position.set(0,0.3, startZ-0.5); car.rotation.set(0,0,0); started=false; finished=false; score=0; lastProgress=0; bestOffset=0;
}
resetCar();

// --- HUD update ---
function updateHUD(){
  document.getElementById('hudSpeed').textContent = (Math.abs(velocity)).toFixed(3);
  document.getElementById('hudProg').textContent = Math.round(lastProgress*100) + '%';
  document.getElementById('hudOffset').textContent = (bestOffset).toFixed(2);
  document.getElementById('hudScore').textContent = Math.round(score);
}

// --- RENDER LOOP ---
function animate(){
  const delta = Math.min(0.05, clock.getDelta());
  updateCar(delta);
  updateCamera(delta);
  updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// handle resize
window.addEventListener('resize', ()=>{ camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// DEBUG: lightweight stats
setInterval(()=>{
  console.log(`Geometries:${renderer.info.memory.geometries} Textures:${renderer.info.memory.textures} Walls:${walls.length}`);
}, 8000);
})();