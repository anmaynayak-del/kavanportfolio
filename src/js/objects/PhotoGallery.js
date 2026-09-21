import * as THREE from 'three';

/**
 * PhotoGallery.js
 *
 * Fetches /api/clicks/list and builds a floating 3D wall of photo planes.
 * Each plane has a dark metallic frame border and drifts in anti-gravity style.
 * Click/tap detection is handled externally via checkRaycast().
 */
export class PhotoGallery {
  /**
   * @param {THREE.Scene}  scene
   * @param {THREE.Camera} camera
   * @param {{ highEnd: boolean }} opts
   */
  constructor(scene, camera, { highEnd = true } = {}) {
    this.scene   = scene;
    this.camera  = camera;
    this.highEnd = highEnd;

    /** @type {Array<{mesh: THREE.Mesh, velocity: THREE.Vector3, rotSpeed: THREE.Vector3, data: {id,caption,url}}>} */
    this.panels  = [];
    this.loaded  = false;
    this._loader = new THREE.TextureLoader();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async load() {
    let photos;
    try {
      const res = await fetch('/api/clicks/list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ({ photos } = await res.json());
    } catch (err) {
      console.warn('[PhotoGallery] Could not load gallery:', err.message);
      return; // gracefully show nothing
    }

    if (!photos || photos.length === 0) return;

    photos.forEach((photo, i) => this._buildPanel(photo, i, photos.length));
    this.loaded = true;
  }

  /** Called from the main animation loop */
  update(delta, input) {
    this.panels.forEach((obj) => {
      const { mesh, velocity, rotSpeed, origin, range } = obj;

      // Drift (simple sin/cos, same pattern as FloatingObjects)
      mesh.position.x = origin.x + Math.sin(performance.now() * 0.0002 + origin.x) * range;
      mesh.position.y = origin.y + Math.cos(performance.now() * 0.00025 + origin.y) * range;

      // Rotation
      mesh.rotation.x += rotSpeed.x;
      mesh.rotation.y += rotSpeed.y;
      mesh.rotation.z += rotSpeed.z;

      // Parallax — lerp, not additive (no drift accumulation)
      if (!obj._px) obj._px = 0;
      if (!obj._py) obj._py = 0;
      obj._px += (input.x * 0.5 - obj._px) * 0.06;
      obj._py += (-input.y * 0.3 - obj._py) * 0.06;

      mesh.position.x += obj._px;
      mesh.position.y += obj._py;
    });
  }

  /**
   * Test a Raycaster against photo panels.
   * @returns {{ url: string, caption: string } | null}
   */
  checkRaycast(raycaster) {
    const meshes = this.panels.map((p) => p.mesh);
    const hits   = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;

    const hitMesh = hits[0].object;
    const panel   = this.panels.find((p) => p.mesh === hitMesh || p.mesh.children.includes(hitMesh));
    return panel ? panel.data : null;
  }

  dispose() {
    this.panels.forEach(({ mesh }) => {
      this.scene.remove(mesh);
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
    });
    this.panels = [];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _buildPanel(photo, index, total) {
    // Layout: spiral/scattered grid, pushed back into the scene
    const cols   = Math.ceil(Math.sqrt(total));
    const col    = index % cols;
    const row    = Math.floor(index / cols);
    const spread = 7;

    const baseX = (col - cols / 2) * spread + (Math.random() - 0.5) * 2;
    const baseY = -(row * 5)       + (Math.random() - 0.5) * 2 + 4;
    const baseZ = -10              + (Math.random() - 0.5) * 4;

    // Photo plane — 4 × 3 units (landscape 4:3)
    const W = 4, H = 3;
    const photoGeo = new THREE.PlaneGeometry(W, H);

    // Load texture asynchronously; placeholder while loading
    const placeholderMat = this._placeholderMaterial();
    const photoMesh      = new THREE.Mesh(photoGeo, placeholderMat);

    this._loader.load(
      photo.url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        photoMesh.material.dispose();
        photoMesh.material = this.highEnd
          ? new THREE.MeshStandardMaterial({
              map: texture,
              roughness: 0.15,
              metalness: 0.05,
            })
          : new THREE.MeshBasicMaterial({ map: texture });
      },
      undefined,
      (err) => console.warn('[PhotoGallery] Texture load error:', err)
    );

    // Frame border — slightly larger dark box
    const frameMat = new THREE.MeshStandardMaterial({
      color:     0x111a00,
      roughness: 0.6,
      metalness: 0.8,
    });
    const frameGeo  = new THREE.BoxGeometry(W + 0.25, H + 0.25, 0.08);
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.z = -0.05;

    // Group frame + photo
    const group = new THREE.Group();
    group.add(frameMesh);
    group.add(photoMesh);

    // Add a soft point light per panel on high-end (gallery "spotlight" feel)
    if (this.highEnd) {
      const light = new THREE.PointLight(0xffffff, 1.5, 12);
      light.position.set(0, 0, 3);
      group.add(light);
    }

    group.position.set(baseX, baseY, baseZ);
    group.rotation.set(
      (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.08
    );

    this.scene.add(group);

    this.panels.push({
      mesh:     photoMesh, // only the photo surface is raycasted
      group,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.003,
        (Math.random() * 0.4 + 0.1) * 0.003,
        0
      ),
      rotSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 0.0008,
        (Math.random() - 0.5) * 0.001,
        (Math.random() - 0.5) * 0.0005
      ),
      origin: group.position.clone(),
      range:  3,
      data:   { id: photo.id, url: photo.url, caption: photo.caption },
    });
  }

  _placeholderMaterial() {
    return new THREE.MeshBasicMaterial({ color: 0x101400 });
  }

  // Expose panels' groups for update loop
  _getPanelGroups() {
    return this.panels.map((p) => p.group);
  }
}
