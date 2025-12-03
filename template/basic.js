(function() {
    function init() {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);

        const box = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        scene.add(box);

        camera.position.z = 5;
        document.getElementById('game-canvas-container').appendChild(renderer.domElement);

        function animate() {
            requestAnimationFrame(animate);
            box.rotation.x += 0.01;
            box.rotation.y += 0.01;
            renderer.render(scene, camera);
        }

        animate();
    }

    init();
})();