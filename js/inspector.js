// js/inspector.js - Object inspector and property editor

// Update object list in inspector
function updateObjectList() {
    const objectList = document.getElementById('objectList');
    objectList.innerHTML = '';

    objects.forEach((obj, index) => {
        if (!obj.userData.isGround) {
            const div = document.createElement('div');
            div.className = 'selected-object';
            if (obj === selectedObject) div.classList.add('active');
            div.textContent = obj.userData.name || `Object_${index}`;
            div.onclick = () => selectObject(obj);
            objectList.appendChild(div);
        }
    });
}

// Select an object
function selectObject(obj) {
    selectedObject = obj;
    updateObjectList();
    updateInspector();
}

// Update inspector with object properties
function updateInspector() {
    const propertyEditor = document.getElementById('propertyEditor');
    const materialSection = document.getElementById('materialSection');

    if (!selectedObject) {
        propertyEditor.style.display = 'none';
        updateAnimationSection();
        return;
    }
    
    propertyEditor.style.display = 'block';
    
    // Update transform inputs
    const inputs = document.querySelectorAll('.inspector-input');
    inputs.forEach(input => {
        const property = input.dataset.property;
        if (property.startsWith('position.')) {
            const axis = property.split('.')[1];
            input.value = selectedObject.position[axis];
        } else if (property.startsWith('rotation.')) {
            const axis = property.split('.')[1];
            input.value = selectedObject.rotation[axis];
        } else if (property.startsWith('scale.')) {
            const axis = property.split('.')[1];
            input.value = selectedObject.scale[axis];
        } else if (property === 'material.color' && selectedObject.material) {
            input.value = '#' + selectedObject.material.color.getHexString();
        }
    });
    
    // Show/hide material section
    if (selectedObject.material) {
        materialSection.style.display = 'block';
    } else {
        materialSection.style.display = 'none';
    }

    // Update animation section
    updateAnimationSection();
}

// Update object property from inspector input
function updateObjectProperty(event) {
    if (!selectedObject) return;

    const input = event.target;
    const property = input.dataset.property;
    const value = input.type === 'color' ? new THREE.Color(input.value) : parseFloat(input.value);

    if (property.startsWith('position.')) {
        const axis = property.split('.')[1];
        selectedObject.position[axis] = value;
    } else if (property.startsWith('rotation.')) {
        const axis = property.split('.')[1];
        selectedObject.rotation[axis] = value;
    } else if (property.startsWith('scale.')) {
        const axis = property.split('.')[1];
        selectedObject.scale[axis] = value;
    } else if (property === 'material.color' && selectedObject.material) {
        selectedObject.material.color = value;
    }
}

// Delete selected object
function deleteSelectedObject() {
    if (!selectedObject) return;

    const index = objects.indexOf(selectedObject);
    if (index > -1) {
        objects.splice(index, 1);
        scene.remove(selectedObject);
        selectedObject = null;
        updateObjectList();
        updateInspector();
    }
}

// Update selected object (refresh inspector display)
function updateSelectedObject() {
    if (selectedObject) {
        updateInspector();
    }
}