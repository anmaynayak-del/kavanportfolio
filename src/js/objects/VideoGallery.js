import * as THREE from 'three';

/**
 * VideoGallery.js
 *
 * Two video planes float in the 3D WebGL scene.
 * They only become visible/active after the user scrolls to the
 * #work-section (IntersectionObserver triggers activation).
 * Clicking a panel opens the full video in the Lightbox.
 */
export class VideoGallery {
  constructor(scene, camera, { highEnd = true } = {}) {
    this.scene   = scene;
    this.camera  = camera;
    this.highEnd = highEnd;

    this.panels  = [];
    this.active  = false; // hidden until user scrolls to work section
    this._setupScrollTrigger();
  }

  /** Watch the work section; activate when it enters the viewport */
  _setupScrollTrigger() {
    const target = document.getElementById('work-section');
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.active) {
            this.active = true;
            this.panels.forEach(({ group }) => {
              group.visible = true;
            });
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(target);
  }

  async load() {
    const videos = [
      { id: 'v1', url: '/lv_0_20260719193006.mp4', caption: 'Creative Project 1' },
      { id: 'v2', url: '/lv_0_20260908072123.mp4', caption: 'Creative Project 2' },
    ];

    videos.forEach((video, i) => this._buildPanel(video, i, videos.length));
    this.loaded = true;
  }

  update(delta, input) {
    if (!this.active) return;
    const t = performance.now();

    this.panels.forEach((obj) => {
      const { group, rotSpeed, origin, range } = obj;

      // Drift — same style as FloatingObjects but slower (theatre feel)
      group.position.x = origin.x + Math.sin(t * 0.00025 + origin.x) * range;
      group.position.y = origin.y + Math.cos(t * 0.0003  + origin.y) * range;

      group.rotation.x += rotSpeed.x;
      group.rotation.y += rotSpeed.y;
      group.rotation.z += rotSpeed.z;

      if (!obj._px) obj._px = 0;
      if (!obj._py) obj._py = 0;
      obj._px += (input.x * 0.6 - obj._px) * 0.05;
      obj._py += (-input.y * 0.4 - obj._py) * 0.05;

      group.position.x += obj._px;
      group.position.y += obj._py;
    });
  }

  checkRaycast(raycaster) {
    if (!this.active) return null;
    const meshes = this.panels.map((p) => p.mesh);
    const hits   = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;

    const hitMesh = hits[0].object;
    const panel   = this.panels.find((p) => p.mesh === hitMesh);
    return panel ? panel.data : null;
  }

  dispose() {
    this.panels.forEach(({ group, videoElement }) => {
      this.scene.remove(group);
      group.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (child.material?.map) child.material.map.dispose();
          child.material?.dispose();
        }
      });
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
      }
    });
    this.panels = [];
  }

  _buildPanel(videoData, index, total) {
    // Place left and right with good spacing, slightly behind scene center
    const positions = [
      { x: -6.5, y: 1.0, z: -7 },
      { x:  6.5, y: 1.0, z: -7 },
    ];
    const { x, y, z } = positions[index] || { x: 0, y: 0, z: -7 };

    const W = 6.4, H = 3.6; // 16:9
    const videoGeo = new THREE.PlaneGeometry(W, H);

    // Video element — muted, paused (thumbnail mode)
    const video = document.createElement('video');
    video.src       = videoData.url;
    video.crossOrigin = 'anonymous';
    video.loop      = true;
    video.muted     = true;
    video.playsInline = true;
    // Seek to first frame so there's something visible, then pause
    video.currentTime = 0.01;
    video.load();

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;

    const screenMat = this.highEnd
      ? new THREE.MeshStandardMaterial({
          map: videoTexture,
          roughness: 0.1,
          metalness: 0.05,
          emissive: new THREE.Color(0x060a00),
          emissiveIntensity: 0.6,
        })
      : new THREE.MeshBasicMaterial({ map: videoTexture });

    const videoMesh = new THREE.Mesh(videoGeo, screenMat);

    // Neon green frame
    const frameMat  = new THREE.MeshStandardMaterial({ color: 0x111a00, roughness: 0.5, metalness: 0.9 });
    const frameGeo  = new THREE.BoxGeometry(W + 0.3, H + 0.3, 0.1);
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.z = -0.06;

    // Thin neon accent border glow
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xd2ff00 });
    const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(W + 0.32, H + 0.32, 0.12));
    const borderLine = new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({ color: 0xd2ff00, linewidth: 2 }));
    borderLine.position.z = -0.06;

    const group = new THREE.Group();
    group.add(frameMesh);
    group.add(videoMesh);
    group.add(borderLine);

    // Neon spotlight above each screen
    if (this.highEnd) {
      const light = new THREE.PointLight(0xd2ff00, 3.0, 18);
      light.position.set(0, 0, 4);
      group.add(light);
    }

    group.position.set(x, y, z);
    group.rotation.set(
      (Math.random() - 0.5) * 0.15,
      index === 0 ? 0.15 : -0.15, // slight inward angle
      (Math.random() - 0.5) * 0.06
    );

    // Start hidden — revealed on scroll
    group.visible = this.active;
    this.scene.add(group);

    this.panels.push({
      mesh:         videoMesh,
      group,
      videoElement: video,
      rotSpeed:     new THREE.Vector3(0.0003, index === 0 ? 0.0008 : -0.0008, 0.0002),
      origin:       group.position.clone(),
      range:        2.0,
      data: { id: videoData.id, url: videoData.url, caption: videoData.caption, isVideo: true },
    });
  }
}
