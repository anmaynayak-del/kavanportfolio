import * as THREE from 'three';

import { PerformanceMonitor } from './utils/PerformanceMonitor.js';
import { QualityManager }     from './utils/QualityManager.js';
import { SceneManager }       from './core/SceneManager.js';
import { InputHandler }       from './mechanics/InputHandler.js';
import { GlobalLoader }       from './ui/Loader.js';
import { Lightbox }           from './ui/Lightbox.js';
const perfMonitor = new PerformanceMonitor();

// ── Reduced-motion: skip all 3D, show a static CSS backdrop ──────────────────
if (perfMonitor.isReduced()) {
  document.documentElement.classList.add('reduced-motion');
  new GlobalLoader(() => {
    const ui = document.getElementById('ui-container');
    if (ui) ui.style.opacity = '1';
    document.querySelectorAll('.fade-section').forEach(s => s.classList.add('visible'));
  });
} else {
  bootThreeJS(perfMonitor);
}

// ── Only mount cursor on non-touch devices ────────────────────────────────────
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (!isTouchDevice) {
  import('./ui/Cursor.js').then(({ CustomCursor }) => new CustomCursor());
}

// ── Lazy-load heavy scene objects on non-reduced devices ──────────────────────
async function bootThreeJS(perf) {
  const canvas       = document.getElementById('webgl-canvas');
  const sceneManager = new SceneManager(canvas, perf);
  const { scene, camera } = sceneManager;

  const inputHandler = new InputHandler();

  // Dynamic imports for heavy modules
  const [
    { Starfield },
    { FloatingObjects },
  ] = await Promise.all([
    import('./objects/Starfield.js'),
    import('./objects/FloatingObjects.js'),
  ]);

  const starfield = new Starfield(scene, { count: perf.starCount() });
  const floaters  = new FloatingObjects(scene, { highEnd: perf.isHighEnd() });

  // ── UI ──────────────────────────────────────────────────────────────────────
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-section').forEach(s => fadeObserver.observe(s));

  new GlobalLoader(() => {
    const ui = document.getElementById('ui-container');
    if (ui) ui.style.opacity = '1';
  });

  // ── Image Lightbox ──────────────────────────────────────────────────────────
  const lightbox = new Lightbox();
  const tickerImages = document.querySelectorAll('.image-ticker img');
  tickerImages.forEach(img => {
    img.addEventListener('click', () => {
      // Pass the high-res URL (currently just src) and alt text as caption
      lightbox.open(img.src, img.alt, false);
    });
  });

  // ── Exclusive video playback & Tab switch auto-pause ────────────────────────
  const allVideos = document.querySelectorAll('.portfolio-video');
  allVideos.forEach((vid) => {
    vid.addEventListener('play', () => {
      allVideos.forEach((other) => {
        if (other !== vid && !other.paused) {
          other.pause();
        }
      });
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      allVideos.forEach((vid) => {
        if (!vid.paused) vid.pause();
      });
    }
  });

  // ── Quality downgrade ───────────────────────────────────────────────────────

  const qualityManager = new QualityManager({
    onDowngrade() {
      sceneManager.disableBloom();
      starfield.downgrade();
    },
  });

  // ── Scroll tracking ─────────────────────────────────────────────────────────
  let currentScroll = 0;
  window.addEventListener('scroll', () => {
    currentScroll = window.scrollY;
  }, { passive: true });

  // ── FPS badge ───────────────────────────────────────────────────────────────
  const fpsBadge = document.getElementById('fps-badge');

  // ── Animation loop ──────────────────────────────────────────────────────────
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta       = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    qualityManager.tick();
    const input = inputHandler.update();

    // Camera parallax tilt
    const tiltScale = perf.isMobile ? 0.04 : 0.08;
    sceneManager.camera.rotation.x = THREE.MathUtils.lerp(
      sceneManager.camera.rotation.x, -input.y * tiltScale, 0.05
    );
    sceneManager.camera.rotation.y = THREE.MathUtils.lerp(
      sceneManager.camera.rotation.y, -input.x * (tiltScale * 1.5), 0.05
    );

    // Scroll parallax + subtle breathing bob
    const baseBob = Math.sin(elapsedTime * 0.25) * 0.3;
    const targetY = -(currentScroll * 0.008) + baseBob;
    sceneManager.camera.position.y = THREE.MathUtils.lerp(
      sceneManager.camera.position.y, targetY, 0.05
    );

    starfield.update(delta);
    floaters.update(delta, input);
    sceneManager.update(elapsedTime);
    sceneManager.render();

    if (fpsBadge) {
      fpsBadge.textContent = `${qualityManager.getFPS().toFixed(0)} fps · ${qualityManager.tier}`;
    }
  }

  animate();

  // HMR cleanup (Vite)
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      sceneManager.dispose();
    });
  }
}
