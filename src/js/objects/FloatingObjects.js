import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * FloatingObjects.js
 *
 * Objects now spread across a much wider area of the screen.
 * More objects, faster rotation & drift, wider placement.
 */
export class FloatingObjects {
  constructor(scene, { highEnd = true } = {}) {
    this.scene   = scene;
    this.highEnd = highEnd;
    this.objects = [];

    // Wide bounds — objects spread to edges
    this.BOUNDS = { x: 12.0, y: 7.0, z: { min: -12, max: -1 } };

    this._spawnPrimitives();
    this._loadCenterpiece();
  }

  _clampedOrigin(x, y, z) {
    return [
      Math.max(-10, Math.min(10, x)),
      Math.max(-6,  Math.min(6,  y)),
      Math.max(-11, Math.min(-2, z)),
    ];
  }

  _randomVelocity(scale = 0.012) {
    return new THREE.Vector3(
      (Math.random() - 0.5) * scale,
      (Math.random() - 0.5) * scale,
      0
    );
  }

  _randomRotSpeed() {
    return new THREE.Vector3(
      (Math.random() - 0.5) * 0.018,
      (Math.random() - 0.5) * 0.022,
      (Math.random() - 0.5) * 0.012
    );
  }

  _makeMaterial(color) {
    return this.highEnd
      ? new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.8 })
      : new THREE.MeshBasicMaterial({ color, wireframe: true });
  }

  _spawnPrimitives() {
    // More objects, spread wide to every corner of the screen
    const configs = [
      // Left side
      { geo: new THREE.IcosahedronGeometry(1.2, 1),        color: 0xd2ff00, pos: [-8.5,  3.5, -5] },
      { geo: new THREE.TorusGeometry(1.0, 0.35, 12, 48),   color: 0xccff00, pos: [-7.0, -3.5, -6] },
      { geo: new THREE.OctahedronGeometry(0.9, 0),          color: 0xd2ff00, pos: [-9.0,  0.5, -4] },
      { geo: new THREE.SphereGeometry(0.65, 16, 16),        color: 0xaaff00, pos: [-6.5, -5.5, -7] },
      // Right side
      { geo: new THREE.TetrahedronGeometry(1.1, 0),         color: 0xccff00, pos: [ 8.5,  3.5, -5] },
      { geo: new THREE.TorusKnotGeometry(0.8, 0.25, 80, 8), color: 0xd2ff00, pos: [ 7.0, -3.5, -6] },
      { geo: new THREE.DodecahedronGeometry(0.9, 0),        color: 0xccff00, pos: [ 9.0,  0.5, -4] },
      { geo: new THREE.SphereGeometry(0.55, 16, 16),        color: 0xaaff00, pos: [ 6.5, -5.5, -7] },
      // Top
      { geo: new THREE.IcosahedronGeometry(0.7, 0),         color: 0xd2ff00, pos: [-3.5,  5.5, -5] },
      { geo: new THREE.TorusGeometry(0.7, 0.22, 12, 48),   color: 0xccff00, pos: [ 3.5,  5.5, -6] },
      // Bottom
      { geo: new THREE.OctahedronGeometry(0.8, 0),          color: 0xd2ff00, pos: [-4.5, -5.5, -6] },
      { geo: new THREE.TetrahedronGeometry(0.75, 0),        color: 0xaaff00, pos: [ 4.5, -5.5, -5] },
      // Center mix
      { geo: new THREE.IcosahedronGeometry(0.6, 0),         color: 0xd2ff00, pos: [-1.5,  1.5, -3] },
      { geo: new THREE.SphereGeometry(0.45, 16, 16),        color: 0xccff00, pos: [ 1.5, -1.5, -3] },
    ];

    configs.forEach(({ geo, color, pos }) => {
      const mesh = new THREE.Mesh(geo, this._makeMaterial(color));
      const safePos = this._clampedOrigin(...pos);
      mesh.position.set(...safePos);
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      this.scene.add(mesh);

      this.objects.push({
        mesh,
        velocity:    this._randomVelocity(),
        rotSpeed:    this._randomRotSpeed(),
        origin:      mesh.position.clone(),
        range:       5.0,   // wide sweep — visibly roams across the screen
        parallaxPos: mesh.position.clone(),
      });
    });
  }

  _loadCenterpiece() {
    const USE_GLTF = false;

    if (USE_GLTF) {
      const loader = new GLTFLoader();
      loader.load('/models/centerpiece.glb', (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(2);
        model.position.set(0, -0.5, -2);
        this.scene.add(model);
        this.objects.push({
          mesh:        model,
          velocity:    this._randomVelocity(0.004),
          rotSpeed:    new THREE.Vector3(0, 0.003, 0),
          origin:      model.position.clone(),
          range:       1.5,
          parallaxPos: model.position.clone(),
        });
      });
    } else {
      // Glowing wireframe icosahedron centerpiece — bigger and brighter
      const geo = new THREE.IcosahedronGeometry(2.5, 4);
      const outer = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0xd2ff00, roughness: 0.05, metalness: 0.9,
        transparent: true, opacity: 0.9,
      }));
      outer.add(new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
        color: 0xccff00, wireframe: true, transparent: true, opacity: 0.3,
      })));
      outer.position.set(0, -0.5, -3);
      this.scene.add(outer);

      this.objects.push({
        mesh:        outer,
        velocity:    this._randomVelocity(0.004),
        rotSpeed:    new THREE.Vector3(0.002, 0.006, 0.001),
        origin:      outer.position.clone(),
        range:       2.0,
        parallaxPos: outer.position.clone(),
      });
    }
  }

  update(delta, input) {
    const B = this.BOUNDS;
    const t = performance.now();

    this.objects.forEach((obj, i) => {
      const { mesh, rotSpeed, origin, range } = obj;

      // Unique phase per object + faster speed = active roaming across full screen
      const phaseX = i * 1.57; // ~π/2 spacing so each object is in a different part of its cycle
      const phaseY = i * 1.05;
      mesh.position.x = origin.x + Math.sin(t * 0.001  + phaseX) * range;
      mesh.position.y = origin.y + Math.cos(t * 0.0012 + phaseY) * range;

      // Rotation
      mesh.rotation.x += rotSpeed.x;
      mesh.rotation.y += rotSpeed.y;
      mesh.rotation.z += rotSpeed.z;

      // Parallax lerp
      const targetOffsetX = input.x * 1.5;
      const targetOffsetY = -input.y * 1.0;
      if (!obj._px) obj._px = 0;
      if (!obj._py) obj._py = 0;
      obj._px += (targetOffsetX - obj._px) * 0.05;
      obj._py += (targetOffsetY - obj._py) * 0.05;

      // Apply and clamp
      const cx = Math.max(-B.x, Math.min(B.x, mesh.position.x + obj._px));
      const cy = Math.max(-B.y, Math.min(B.y, mesh.position.y + obj._py));
      mesh.position.x = cx;
      mesh.position.y = cy;
    });
  }

  dispose() {
    this.objects.forEach(({ mesh }) => {
      this.scene.remove(mesh);
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material?.dispose();
        }
      });
    });
    this.objects = [];
  }
}
