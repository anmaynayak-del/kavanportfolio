import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * SceneManager.js
 *
 * Fixes applied in responsiveness audit:
 * - Debounced resize handler (no more hundreds of resize calls on orientation change)
 * - Full dispose() method to free GPU memory on HMR / teardown
 * - reduced-motion mode: skips EffectComposer entirely, uses raw renderer
 * - Lazy EffectComposer: not created at all in reduced/low tier
 * - Pixel ratio capped per tier via PerformanceMonitor.maxPixelRatio()
 */
export class SceneManager {
  constructor(canvas, performanceMonitor) {
    this.canvas  = canvas;
    this.perf    = performanceMonitor;
    this._rafId  = null;
    this._resizeTimer = null;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x101400, this.perf.isHighEnd() ? 0.006 : 0.01);

    this._setupCamera();
    this._setupRenderer();
    this._setupLights();
    this._setupPostProcessing();

    this._resizeHandler = this._onResizeDebounced.bind(this);
    window.addEventListener('resize', this._resizeHandler);
    // orientationchange fires before innerWidth updates — use resize instead,
    // but also listen to orientationchange for an extra forced redraw
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this._applyResize(), 300);
    });
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  _setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      70, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    this.camera.position.z = 18;
  }

  // ── Renderer ───────────────────────────────────────────────────────────────
  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.perf.isHighEnd(),
      alpha: true,
      powerPreference: this.perf.isHighEnd() ? 'high-performance' : 'low-power',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.perf.maxPixelRatio())
    );
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    if (this.perf.isHighEnd()) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    }
  }

  // ── Lighting ──────────────────────────────────────────────────────────────
  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0x111a00, 2));

    if (this.perf.isHighEnd()) {
      const key = new THREE.DirectionalLight(0xd2ff00, 3);
      key.position.set(12, 20, 8);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      this.scene.add(key);

      const rim = new THREE.DirectionalLight(0xd2ff00, 1.5);
      rim.position.set(-15, -10, -5);
      this.scene.add(rim);

      this._floatingPoint = new THREE.PointLight(0xd2ff00, 8, 30);
      this._floatingPoint.position.set(0, 5, 5);
      this.scene.add(this._floatingPoint);
    } else if (this.perf.isMediumEnd()) {
      const key = new THREE.DirectionalLight(0xd2ff00, 2.5);
      key.position.set(12, 20, 8);
      this.scene.add(key);
      const rim = new THREE.DirectionalLight(0xd2ff00, 1);
      rim.position.set(-15, -10, -5);
      this.scene.add(rim);
    } else {
      const flat = new THREE.DirectionalLight(0xffffff, 2);
      flat.position.set(5, 10, 7.5);
      this.scene.add(flat);
    }
  }

  // ── Post-processing ────────────────────────────────────────────────────────
  _setupPostProcessing() {
    // In reduced-motion or low tier: skip EffectComposer entirely
    if (this.perf.isReduced() || this.perf.tier === 'low') {
      this.composer  = null;
      this.bloomPass = null;
      return;
    }

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Tune bloom per tier
    const bloomStrength = this.perf.isHighEnd() ? 0.6 : 0.3;
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomStrength, 0.5, 0.75
    );
    this.composer.addPass(this.bloomPass);
  }

  // ── Public controls ────────────────────────────────────────────────────────
  disableBloom() {
    if (this.bloomPass) this.bloomPass.enabled = false;
  }
  enableBloom() {
    if (this.bloomPass) this.bloomPass.enabled = true;
  }

  // ── Resize (debounced 150ms) ───────────────────────────────────────────────
  _onResizeDebounced() {
    clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => this._applyResize(), 150);
  }

  _applyResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.perf.maxPixelRatio()));
    if (this.composer) this.composer.setSize(w, h);
  }

  // ── Per-frame ─────────────────────────────────────────────────────────────
  update(elapsedTime) {
    if (this._floatingPoint) {
      this._floatingPoint.position.x = Math.sin(elapsedTime * 0.4) * 10;
      this._floatingPoint.position.y = Math.cos(elapsedTime * 0.3) * 8;
    }
  }

  render() {
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ── Cleanup (prevents GPU memory leaks on HMR / route change) ─────────────
  dispose() {
    window.removeEventListener('resize', this._resizeHandler);
    clearTimeout(this._resizeTimer);

    // Traverse and dispose all geometries + materials
    this.scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });

    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
