// js/code-generator.js - Code generation and export functionality

// Switch between preview and code modes
function switchToPreview() {
    document.getElementById('canvas').style.display = 'block';
    document.getElementById('codeDisplay').style.display = 'none';
}

function switchToCode() {
    document.getElementById('canvas').style.display = 'none';
    document.getElementById('codeDisplay').style.display = 'block';
    generateCode();
}

// Generate Three.js code from scene
function generateCode() {
    let code = `const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Ground
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2;
ground.receiveShadow = true;
scene.add(ground);

// Lights
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Objects\n`;

    objects.forEach((obj, index) => {
        if (!obj.userData.isGround && obj.userData.type !== 'light') {
            if (obj.userData.type === 'gltf') {
                code += `// Imported model: ${obj.userData.fileName}
// Position: (${obj.position.x}, ${obj.position.y}, ${obj.position.z})
// Rotation: (${obj.rotation.x}, ${obj.rotation.y}, ${obj.rotation.z})
// Scale: (${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z})\n\n`;
            } else if (obj.isMesh) {
                const type = obj.userData.type || 'cube';
                const color = obj.material.color.getHexString();
                code += `// ${type.charAt(0).toUpperCase() + type.slice(1)}
const geometry${index} = new THREE.${getGeometryType(obj)};
const material${index} = new THREE.MeshStandardMaterial({
    color: 0x${color},
    roughness: 0.7,
    metalness: 0.2
});
const mesh${index} = new THREE.Mesh(geometry${index}, material${index});
mesh${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
mesh${index}.rotation.set(${obj.rotation.x}, ${obj.rotation.y}, ${obj.rotation.z});
mesh${index}.scale.set(${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z});
mesh${index}.castShadow = true;
mesh${index}.receiveShadow = true;
scene.add(mesh${index});\n\n`;
            }
        }
    });

    code += `// Camera controls (WASD movement, mouse look)
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

const velocity = new THREE.Vector3();

let prevTime = performance.now();
let pitch = 0;
let yaw = 0;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'Space':
            if (canJump) velocity.y += 350;
            canJump = false;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
}

function onMouseDown(event) {
    isDragging = true;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseMove(event) {
    if (!isDragging) return;
    
    const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
    };
    
    yaw -= deltaMove.x * 0.01;
    pitch -= deltaMove.y * 0.01;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseUp() {
    isDragging = false;
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= 9.8 * 100.0 * delta; // gravity
    
    // Movement relative to camera direction
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    
    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up).normalize();
    
    const inputX = Number(moveRight) - Number(moveLeft);
    const inputZ = Number(moveForward) - Number(moveBackward);
    
    const moveVector = new THREE.Vector3();
    moveVector.addScaledVector(right, inputX);
    moveVector.addScaledVector(forward, inputZ);
    
    if (moveVector.length() > 0) {
        moveVector.normalize();
        velocity.x -= moveVector.x * 400.0 * delta;
        velocity.z -= moveVector.z * 400.0 * delta;
    }
    
    camera.translateX(velocity.x * delta);
    camera.translateZ(velocity.z * delta);
    camera.position.y += velocity.y * delta;
    
    // Ground collision
    if (camera.position.y < 1) {
        velocity.y = 0;
        camera.position.y = 1;
        canJump = true;
    }
    
    prevTime = time;
    
    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});`;

    document.getElementById('codeDisplay').value = code;
}

function getGeometryType(mesh) {
    if (mesh.geometry.type.includes('Box')) return 'BoxGeometry(2, 2, 2)';
    if (mesh.geometry.type.includes('Sphere')) return 'SphereGeometry(1, 32, 32)';
    if (mesh.geometry.type.includes('Cone')) return 'ConeGeometry(1, 2, 32)';
    if (mesh.geometry.type.includes('Cylinder')) return 'CylinderGeometry(1, 1, 2, 32)';
    if (mesh.geometry.type.includes('Plane')) return 'PlaneGeometry(5, 5)';
    return 'BoxGeometry(2, 2, 2)';
}

// Export game
function exportGame() {
    let code = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported 3D Game</title>
    <script src="https://unpkg.com/three@0.128.0/build/three.min.js"></script>
    <style>
        body { margin: 0; overflow: hidden; }
        canvas { display: block; }
    </style>
</head>
<body>
    <script>
        const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Ground
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2;
ground.receiveShadow = true;
scene.add(ground);

// Lights
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Objects\n`;

    objects.forEach((obj, index) => {
        if (!obj.userData.isGround && obj.userData.type !== 'light') {
            if (obj.userData.type === 'gltf') {
                code += `// Imported model: ${obj.userData.fileName}
// Position: (${obj.position.x}, ${obj.position.y}, ${obj.position.z})
// Rotation: (${obj.rotation.x}, ${obj.rotation.y}, ${obj.rotation.z})
// Scale: (${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z})\n\n`;
            } else if (obj.isMesh) {
                const type = obj.userData.type || 'cube';
                const color = obj.material.color.getHexString();
                code += `// ${type.charAt(0).toUpperCase() + type.slice(1)}
const geometry${index} = new THREE.${getGeometryType(obj)};
const material${index} = new THREE.MeshStandardMaterial({
    color: 0x${color},
    roughness: 0.7,
    metalness: 0.2
});
const mesh${index} = new THREE.Mesh(geometry${index}, material${index});
mesh${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
mesh${index}.rotation.set(${obj.rotation.x}, ${obj.rotation.y}, ${obj.rotation.z});
mesh${index}.scale.set(${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z});
mesh${index}.castShadow = true;
mesh${index}.receiveShadow = true;
scene.add(mesh${index});\n\n`;
            }
        }
    });

    code += `// Camera controls (WASD movement, mouse look)
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

const velocity = new THREE.Vector3();

let prevTime = performance.now();
let pitch = 0;
let yaw = 0;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Smooth camera rotation variables
const rotationSmoothness = 0.15; // Lower = smoother, higher = more responsive
let targetPitch = 0;
let targetYaw = 0;
let currentPitch = 0;
let currentYaw = 0;

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;  // Fixed: W should move forward
            break;
        case 'ArrowLeft':
        case 'KeyA':
            
            moveRight = true;  // Fixed: D should move right
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;  // Fixed: S should move backward
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveLeft = true;  // Fixed: A should move left
            break;
        case 'Space':
            if (canJump) velocity.y += 350;
            canJump = false;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveRight = false;

            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            
            moveLeft = false;
            break;
    }
}

function onMouseDown(event) {
    isDragging = true;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseMove(event) {
    if (!isDragging) return;
    
    const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
    };
    
    // Apply smoothing to target rotations
    targetYaw -= deltaMove.x * 0.002; // Reduced sensitivity for smoother rotation
    targetPitch -= deltaMove.y * 0.002;
    targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch));
    
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseUp() {
    isDragging = false;
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= 9.8 * 100.0 * delta; // gravity
    
    // Smooth camera rotation interpolation
    currentYaw += (targetYaw - currentYaw) * rotationSmoothness;
    currentPitch += (targetPitch - currentPitch) * rotationSmoothness;
    
    camera.rotation.order = 'YXZ';
    camera.rotation.y = currentYaw;
    camera.rotation.x = currentPitch;
    
    // Movement relative to camera direction - more precise calculation
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    
    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).normalize(); // Fixed cross product order
    
    // Calculate movement input
    const inputX = Number(moveRight) - Number(moveLeft);
    const inputZ = Number(moveForward) - Number(moveBackward);
    
    // Create movement vector based on camera orientation
    const moveVector = new THREE.Vector3();
    
    if (inputX !== 0) {
        moveVector.addScaledVector(right, inputX);
    }
    if (inputZ !== 0) {
        moveVector.addScaledVector(forward, inputZ);
    }
    
    if (moveVector.length() > 0) {
        moveVector.normalize();
        velocity.x += moveVector.x * 400.0 * delta;  // Changed from -= to + for proper direction
        velocity.z += moveVector.z * 400.0 * delta;  // Changed from -= to + for proper direction
    }
    
    // Apply movement
    const deltaVector = new THREE.Vector3(velocity.x * delta, velocity.y * delta, velocity.z * delta);
    camera.position.add(deltaVector);
    
    // Ground collision
    if (camera.position.y < 1) {
        velocity.y = 0;
        camera.position.y = 1;
        canJump = true;
    }
    
    prevTime = time;
    
    renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
    </script>
</body>
</html>`;

    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game.html';
    a.click();
    URL.revokeObjectURL(url);
}