
(function () {
    const canvas = document.getElementById('robot-canvas');
    if (!canvas) return;

    /* ---------- Scene / Camera / Renderer ---------- */
    const scene   = new THREE.Scene();
    const W = window.innerWidth, H = window.innerHeight;
    const camera  = new THREE.PerspectiveCamera(40, W / H, 0.1, 200);
    camera.position.set(0, 1.5, 14);
    camera.lookAt(0, 1.5, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.physicallyCorrectLights = true;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;

    /* ---------- Materials ---------- */

    // Deep gloss black (helmet, shoulders, chest plate)
    const glossBlack = new THREE.MeshPhysicalMaterial({
        color: 0x090909,
        metalness: 1.0,
        roughness: 0.06,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        reflectivity: 1.0,
    });

    // Slightly lighter gloss for edges / neck
    const glossDark = new THREE.MeshPhysicalMaterial({
        color: 0x141414,
        metalness: 0.9,
        roughness: 0.15,
        clearcoat: 0.6,
    });

    // Carbon-dot texture for the suit body
    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = dotCanvas.height = 128;
    const dc = dotCanvas.getContext('2d');
    dc.fillStyle = '#0e0e0e';
    dc.fillRect(0, 0, 128, 128);
    dc.fillStyle = '#252525';
    for (let y = 5; y < 128; y += 10) {
        for (let x = (y % 20 === 5 ? 5 : 10); x < 128; x += 10) {
            dc.beginPath();
            dc.arc(x, y, 1.6, 0, Math.PI * 2);
            dc.fill();
        }
    }
    const dotTex = new THREE.CanvasTexture(dotCanvas);
    dotTex.wrapS = dotTex.wrapT = THREE.RepeatWrapping;
    dotTex.repeat.set(8, 12);

    const suitMat = new THREE.MeshStandardMaterial({
        map: dotTex,
        metalness: 0.5,
        roughness: 0.6,
    });

    // Eye dot material (bright white / light grey)
    const eyeDotMat = new THREE.MeshBasicMaterial({ color: 0xdde8ff });
    const eyeDotDimMat = new THREE.MeshBasicMaterial({ color: 0x555e70 });

    // Eye recess (dark socket behind dots)
    const eyeSocketMat = new THREE.MeshStandardMaterial({ color: 0x040408, roughness: 1 });

    /* ---------- Root group ---------- */
    const root = new THREE.Group();
    scene.add(root);

    /* ===================== TORSO ===================== */
    // Main torso – CapsuleGeometry needs r150+; use cylinder + spheres as fallback
    let torsoMesh;
    try {
        const tGeo = new THREE.CapsuleGeometry(1.45, 3.2, 6, 32);
        torsoMesh = new THREE.Mesh(tGeo, suitMat);
    } catch (e) {
        const tGeo = new THREE.CylinderGeometry(1.3, 1.1, 3.6, 32);
        torsoMesh = new THREE.Mesh(tGeo, suitMat);
    }
    torsoMesh.position.y = -0.4;
    root.add(torsoMesh);

    // Chest armour plate (glossy shell over suit)
    const chestGeo = new THREE.SphereGeometry(1.6, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const chest = new THREE.Mesh(chestGeo, glossBlack);
    chest.rotation.x = -Math.PI / 2;
    chest.position.set(0, 0.5, 0.6);
    root.add(chest);

    /* ===================== SHOULDERS ===================== */
    const makeShoulderCap = (side) => {
        const geo = new THREE.SphereGeometry(0.98, 48, 32);
        const m = new THREE.Mesh(geo, glossBlack);
        m.scale.set(1, 0.85, 0.8);
        m.position.set(side * 2.4, 0.8, 0);
        root.add(m);
    };
    makeShoulderCap(-1);
    makeShoulderCap(1);

    /* ===================== UPPER ARMS ===================== */
    const makeArm = (side) => {
        const g = new THREE.CylinderGeometry(0.55, 0.45, 2.2, 24);
        const m = new THREE.Mesh(g, suitMat);
        m.position.set(side * 2.55, -1.1, 0);
        root.add(m);
        // arm gloss cap
        const capG = new THREE.SphereGeometry(0.48, 24, 16);
        const cap  = new THREE.Mesh(capG, glossBlack);
        cap.position.set(side * 2.55, -2.25, 0);
        root.add(cap);
    };
    makeArm(-1);
    makeArm(1);

    /* ===================== NECK ===================== */
    const neckGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.9, 24);
    const neck = new THREE.Mesh(neckGeo, glossDark);
    neck.position.y = 2.05;
    root.add(neck);

    /* ===================== HEAD ===================== */
    const headPivot = new THREE.Group();
    headPivot.position.y = 2.05;
    root.add(headPivot);

    // Helmet shell — smooth oval (wider than tall)
    const helmGeo = new THREE.SphereGeometry(1.55, 64, 64);
    // Slightly squash on Z (front-back) so it reads as a helmet visor
    const helmMesh = new THREE.Mesh(helmGeo, glossBlack);
    helmMesh.scale.set(1.0, 1.15, 0.92);
    helmMesh.position.y = 1.4;
    headPivot.add(helmMesh);

    /* ====  EYES: rectangular LED-matrix panels  ==== */

    const buildEyePanel = (offsetX, slantDir) => {
        const panelGroup = new THREE.Group();

        // Recessed socket
        const sockW = 0.90, sockH = 0.42, sockD = 0.08;
        const sockGeo = new THREE.BoxGeometry(sockW, sockH, sockD);
        const sock = new THREE.Mesh(sockGeo, eyeSocketMat);
        panelGroup.add(sock);

        // Dot grid
        const cols = 12, rows = 5, spacing = 0.064;
        const dotRadius = 0.024;
        const dGeo = new THREE.SphereGeometry(dotRadius, 6, 6);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Skip corners to make it look rounded
                if ((r === 0 || r === rows-1) && (c === 0 || c === cols-1)) continue;
                if ((r === 0 || r === rows-1) && (c === 1 || c === cols-2)) continue;

                const bright = (r >= 1 && r <= rows-2 && c >= 1 && c <= cols-2);
                const dot = new THREE.Mesh(dGeo, bright ? eyeDotMat : eyeDotDimMat);
                dot.position.set(
                    (c - (cols-1) / 2) * spacing,
                    (r - (rows-1) / 2) * spacing,
                    sockD / 2 + 0.01
                );
                panelGroup.add(dot);
            }
        }

        // Position relative to the helmet
        panelGroup.position.set(offsetX, 1.45, 1.32);
        panelGroup.rotation.z = slantDir * 0.12; // slight inward slant
        headPivot.add(panelGroup);
        return panelGroup;
    };

    const eyeL = buildEyePanel(-0.5,  1);
    const eyeR = buildEyePanel( 0.5, -1);
    const eyePanels = [eyeL, eyeR];

    /* ---------- Lights ---------- */
    // Ambient fill
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Key light — bright top-left (creates that glossy catchlight)
    const keyLight = new THREE.DirectionalLight(0xffffff, 5);
    keyLight.position.set(-4, 8, 6);
    scene.add(keyLight);

    // Fill light — right side
    const fillLight = new THREE.DirectionalLight(0xb0c8ff, 2.5);
    fillLight.position.set(6, 2, 4);
    scene.add(fillLight);

    // Rim / back light — creates the glowing edge silhouette
    const rimLight = new THREE.DirectionalLight(0xffffff, 6);
    rimLight.position.set(0, 6, -8);
    scene.add(rimLight);

    // Subtle warm bottom bounce
    const bounceLight = new THREE.PointLight(0x2a1a00, 2, 20);
    bounceLight.position.set(0, -5, 3);
    scene.add(bounceLight);

    /* ---------- Mouse tracking ---------- */
    let mx = 0, my = 0, tx = 0, ty = 0;

    window.addEventListener('mousemove', e => {
        mx = (e.clientX / window.innerWidth)  * 2 - 1;
        my = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    /* ---------- Resize ---------- */
    window.addEventListener('resize', () => {
        const W = window.innerWidth, H = window.innerHeight;
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        renderer.setSize(W, H);
    });

    /* ---------- Animate ---------- */
    const clock = new THREE.Clock();

    (function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Smooth damp
        tx += (mx - tx) * 0.06;
        ty += (my - ty) * 0.06;

        // Head tracks mouse
        headPivot.rotation.y = tx * 0.55;
        headPivot.rotation.x = -ty * 0.35;

        // Subtle body shift
        root.rotation.y = tx * 0.08;
        root.position.y = Math.sin(t * 0.7) * 0.12 - 0.5;

        // Pulse eye brightness
        const pulse = 0.7 + 0.3 * Math.sin(t * 2.5);
        eyeDotMat.color.setRGB(pulse * 0.87, pulse * 0.91, pulse);

        renderer.render(scene, camera);
    })();
})();
