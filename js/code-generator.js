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

// Lights\n`;

    // Generate lights code
    let hasLights = false;
    objects.forEach((obj, index) => {
        if (obj.isLight) {
            hasLights = true;
            if (obj.type === 'AmbientLight') {
                code += `// Ambient Light
const ambientLight = new THREE.AmbientLight(0x${obj.color.getHexString()}, ${obj.intensity});
scene.add(ambientLight);\n\n`;
            } else if (obj.type === 'DirectionalLight') {
                code += `// Directional Light
const directionalLight = new THREE.DirectionalLight(0x${obj.color.getHexString()}, ${obj.intensity});
directionalLight.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
directionalLight.castShadow = true;
scene.add(directionalLight);\n\n`;
            } else if (obj.type === 'PointLight') {
                code += `// Point Light
const pointLight = new THREE.PointLight(0x${obj.color.getHexString()}, ${obj.intensity}, ${obj.distance});
pointLight.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
scene.add(pointLight);\n\n`;
            }
        }
    });
    
    if (!hasLights) {
        code += `// Default lights if none were added
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);\n\n`;
    }

    code += `// Objects\n`;

    // Generate objects code
    objects.forEach((obj, index) => {
        if (!obj.userData.isGround && !obj.isLight) {
            if (obj.userData.type === 'gltf') {
                // For GLTF models, add loading code
                code += `// Imported model: ${obj.userData.fileName}
const model${index} = new THREE.Object3D();
model${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
model${index}.rotation.set(${obj.rotation.x}, ${obj.rotation.y}, ${obj.rotation.z});
model${index}.scale.set(${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z});

// Note: To load the GLTF model, you'll need to:
// 1. Include GLTFLoader: <script src="https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
// 2. Load the model and add it to scene
// const loader = new THREE.GLTFLoader();
// loader.load('${obj.userData.fileName}', (gltf) => {
//     gltf.scene.position.copy(model${index}.position);
//     gltf.scene.rotation.copy(model${index}.rotation);
//     gltf.scene.scale.copy(model${index}.scale);
//     scene.add(gltf.scene);
// });
scene.add(model${index});\n\n`;
            } else if (obj.isMesh) {
                const type = obj.userData.type || 'cube';
                const color = obj.material.color.getHexString ? obj.material.color.getHexString() : 'ffffff';
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

    // Add camera controls
    code += generateCameraControls();

    document.getElementById('codeDisplay').value = code;
}

function generateCameraControls() {
    return `// Camera controls (WASD movement, mouse look)
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
const rotationSmoothness = 0.15;
let targetPitch = 0;
let targetYaw = 0;
let currentPitch = 0;
let currentYaw = 0;

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveRight = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveLeft = true;
            break;
        case 'Space':
            if (canJump) {
                // Lompatan lebih pendek dan halus (0.27x dari sebelumnya: 350 -> 94.5)
                velocity.y += 94.5;
                canJump = false;
            }
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
    
    targetYaw -= deltaMove.x * 0.002;
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
    
    // Gesekan untuk gerakan lebih halus
    velocity.x -= velocity.x * 12.0 * delta;
    velocity.z -= velocity.z * 12.0 * delta;
    // Gravitasi lebih lembut (0.27x dari sebelumnya: 9.8*100 -> 9.8*27)
    velocity.y -= 9.8 * 27.0 * delta;
    
    // Smooth camera rotation interpolation
    currentYaw += (targetYaw - currentYaw) * rotationSmoothness;
    currentPitch += (targetPitch - currentPitch) * rotationSmoothness;
    
    camera.rotation.order = 'YXZ';
    camera.rotation.y = currentYaw;
    camera.rotation.x = currentPitch;
    
    // Movement relative to camera direction
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    
    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).normalize();
    
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
        // Kecepatan gerakan lebih lambat (0.27x dari 400 -> 108)
        velocity.x += moveVector.x * 108.0 * delta;
        velocity.z += moveVector.z * 108.0 * delta;
    }
    
    // Apply movement
    const deltaVector = new THREE.Vector3(velocity.x * delta, velocity.y * delta, velocity.z * delta);
    camera.position.add(deltaVector);
    
    // Ground collision - dengan threshold yang lebih kecil untuk lompatan pendek
    if (camera.position.y < 1) {
        velocity.y = 0;
        camera.position.y = 1;
        canJump = true;
    }
    
    prevTime = time;
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});`;
}

function getGeometryType(mesh) {
    if (mesh.geometry.type.includes('Box')) return 'BoxGeometry(2, 2, 2)';
    if (mesh.geometry.type.includes('Sphere')) return 'SphereGeometry(1, 32, 32)';
    if (mesh.geometry.type.includes('Cone')) return 'ConeGeometry(1, 2, 32)';
    if (mesh.geometry.type.includes('Cylinder')) return 'CylinderGeometry(1, 1, 2, 32)';
    if (mesh.geometry.type.includes('Plane')) return 'PlaneGeometry(5, 5)';
    return 'BoxGeometry(2, 2, 2)';
}

// Export game with all objects including GLTF
function exportGame() {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported 3D Game</title>
    <script src="https://unpkg.com/three@0.128.0/build/three.min.js"></script>
    <script src="https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
    <style>
        body { margin: 0; overflow: hidden; }
        canvas { display: block; }
    </style>
</head>
<body>
    <div id="loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-family: Arial; z-index: 1000;">
        Loading models...
    </div>
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

        // Lights\n`;

    // Add all lights
    objects.forEach((obj, index) => {
        if (obj.isLight) {
            if (obj.type === 'AmbientLight') {
                html += `        // Ambient Light ${index}
        const ambientLight${index} = new THREE.AmbientLight(0x${obj.color.getHexString()}, ${obj.intensity});
        scene.add(ambientLight${index});\n`;
            } else if (obj.type === 'DirectionalLight') {
                html += `        // Directional Light ${index}
        const directionalLight${index} = new THREE.DirectionalLight(0x${obj.color.getHexString()}, ${obj.intensity});
        directionalLight${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
        directionalLight${index}.castShadow = true;
        scene.add(directionalLight${index});\n`;
            } else if (obj.type === 'PointLight') {
                html += `        // Point Light ${index}
        const pointLight${index} = new THREE.PointLight(0x${obj.color.getHexString()}, ${obj.intensity}, ${obj.distance});
        pointLight${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
        scene.add(pointLight${index});\n`;
            }
        }
    });

    // Add all meshes (including GLTF placeholders)
    let modelCount = 0;
    objects.forEach((obj, index) => {
        if (!obj.userData.isGround && !obj.isLight) {
            if (obj.userData.type === 'gltf') {
                // Create placeholder object for GLTF model
                html += `        // GLTF Model: ${obj.userData.fileName}
        const modelPlaceholder${index} = new THREE.Object3D();
        modelPlaceholder${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
        modelPlaceholder${index}.rotation.set(${obj.rotation.x}, ${obj.rotation.y}, ${obj.rotation.z});
        modelPlaceholder${index}.scale.set(${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z});
        scene.add(modelPlaceholder${index});\n`;
                modelCount++;
            } else if (obj.isMesh) {
                const type = obj.userData.type || 'cube';
                const color = obj.material.color.getHexString ? obj.material.color.getHexString() : 'ffffff';
                html += `        // ${type.charAt(0).toUpperCase() + type.slice(1)} ${index}
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
        scene.add(mesh${index});\n`;
            }
        }
    });

    // Add GLTF loading code if there are models
    if (modelCount > 0) {
        html += `
        // GLTF Models loading
        const loader = new THREE.GLTFLoader();
        let modelsLoaded = 0;
        const totalModels = ${modelCount};\n`;

        let modelIndex = 0;
        objects.forEach((obj, index) => {
            if (obj.userData.type === 'gltf') {
                html += `
        // Loading model ${obj.userData.fileName}
        loader.load('models/${obj.userData.fileName}', (gltf) => {
            gltf.scene.position.copy(modelPlaceholder${index}.position);
            gltf.scene.rotation.copy(modelPlaceholder${index}.rotation);
            gltf.scene.scale.copy(modelPlaceholder${index}.scale);
            gltf.scene.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            scene.remove(modelPlaceholder${index});
            scene.add(gltf.scene);
            
            modelsLoaded++;
            if (modelsLoaded === totalModels) {
                document.getElementById('loading').style.display = 'none';
            }
        }, undefined, (error) => {
            console.error('Error loading model:', error);
            modelsLoaded++;
            if (modelsLoaded === totalModels) {
                document.getElementById('loading').style.display = 'none';
            }
        });\n`;
                modelIndex++;
            }
        });
    } else {
        html += `        document.getElementById('loading').style.display = 'none';\n`;
    }

    // Add camera controls
    html += `
        ${generateCameraControls()}
    </script>
</body>
</html>`;

    // Create a ZIP file containing the HTML and all GLTF models
    const zip = new JSZip();
    zip.file("game.html", html);

    // Add all GLTF models to the ZIP
    objects.forEach((obj) => {
        if (obj.userData.type === 'gltf' && obj.userData.originalFile) {
            zip.file(`models/${obj.userData.fileName}`, obj.userData.originalFile);
        }
    });

    // Generate and download the ZIP
    zip.generateAsync({ type: "blob" })
        .then(function(content) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(content);
            a.download = 'game.zip';
            a.click();
            URL.revokeObjectURL(a.href);
        });
}