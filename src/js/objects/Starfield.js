import * as THREE from 'three';

/**
 * Starfield.js
 * Stars are distributed in a full sphere around the camera,
 * guaranteeing full coverage at every edge including far right/left.
 */
export class Starfield {
  constructor(scene, { count = 8000 } = {}) {
    this.scene  = scene;
    this._count = count;
    this._mesh  = null;
    this._build(count);
  }

  _build(count) {
    const positions = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Spherical distribution: guaranteed uniform coverage in ALL directions
      const radius = Math.random() * 120 + 30;   // distance from origin: 30–150
      const theta  = Math.random() * Math.PI * 2; // azimuth: 0–360°
      const phi    = Math.acos(2 * Math.random() - 1); // polar: 0–180° (uniform)

      positions[i3]     = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      sizes[i] = Math.random() * 0.15 + 0.08;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.22,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    if (this._mesh) {
      this.scene.remove(this._mesh);
      this._mesh.geometry.dispose();
      this._mesh.material.dispose();
    }

    this._mesh = new THREE.Points(geo, mat);
    this.scene.add(this._mesh);
  }

  update(delta) {
    if (this._mesh) {
      // Very slow rotation — gives a living, breathing feel
      this._mesh.rotation.y += delta * 0.004;
      this._mesh.rotation.x += delta * 0.001;
    }
  }

  downgrade() {
    this._build(Math.floor(this._count / 2));
  }

  dispose() {
    if (this._mesh) {
      this.scene.remove(this._mesh);
      this._mesh.geometry.dispose();
      this._mesh.material.dispose();
    }
  }
}
