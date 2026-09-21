/**
 * InputHandler.js
 * Unified input: mouse parallax (desktop), touch drag (mobile/tablet),
 * gyroscope tilt (mobile with permission).
 *
 * Touch dead-zone: small finger movements (scrolling) are ignored so they
 * don't fight the page scroll handler.
 */
export class InputHandler {
  constructor() {
    this.target  = { x: 0, y: 0 };
    this.current = { x: 0, y: 0 };

    // Lerp is faster on desktop (snappier feel), slower on mobile (gyro lag)
    this.lerp = 0.07;

    this._touchStart   = null;
    this._gyroActive   = false;
    this._isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    this._bindMouse();
    this._bindTouch();
    this._initGyro();
  }

  // ── Mouse (desktop only) ───────────────────────────────────────────────────
  _bindMouse() {
    if (this._isTouchDevice) return; // skip on touch devices to save event budget
    window.addEventListener('mousemove', (e) => {
      this.target.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
      this.target.y =  (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  // ── Touch drag parallax ────────────────────────────────────────────────────
  _bindTouch() {
    const DEAD_ZONE = 8; // px — smaller moves are treated as scroll, not parallax

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      this._touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!this._touchStart || e.touches.length !== 1) return;

      const dx = e.touches[0].clientX - this._touchStart.x;
      const dy = e.touches[0].clientY - this._touchStart.y;

      // Inside dead zone — treat as scroll, don't move camera
      if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return;

      // Only apply horizontal drag as parallax, let vertical be for scroll
      this.target.x = Math.max(-1, Math.min(1, dx / (window.innerWidth * 0.3)));
      // Reduced y influence on touch — vertical gesture = scroll intent
      this.target.y = Math.max(-1, Math.min(1, dy / (window.innerHeight * 0.6)));
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this._touchStart = null;
      // Ease back to centre over next few frames via lerp
      this.target.x = 0;
      this.target.y = 0;
    }, { passive: true });
  }

  // ── Gyroscope ─────────────────────────────────────────────────────────────
  _initGyro() {
    if (typeof DeviceOrientationEvent === 'undefined') return;

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ — needs explicit user gesture
      this.requestGyroPermission = async () => {
        try {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res === 'granted') this._listenGyro();
        } catch (err) {
          console.warn('[InputHandler] Gyro permission denied:', err);
        }
      };
    } else if (this._isTouchDevice) {
      // Android / other touch devices — no permission gate needed
      this._listenGyro();
    }
    // Desktop browsers fire deviceorientation too, but we skip it (not useful)
  }

  _listenGyro() {
    this._gyroActive = true;
    this.lerp = 0.04; // smoother lerp for gyro input

    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma === null || e.beta === null) return;
      // gamma = left/right (-90..90), beta = front/back (-180..180)
      this.target.x =  Math.max(-1, Math.min(1,  e.gamma / 25));
      this.target.y =  Math.max(-1, Math.min(1, (e.beta  - 45) / 40));
    }, { passive: true });
  }

  // ── Per-frame update ───────────────────────────────────────────────────────
  update() {
    this.current.x += (this.target.x - this.current.x) * this.lerp;
    this.current.y += (this.target.y - this.current.y) * this.lerp;
    return this.current;
  }

  destroy() {
    // For future HMR cleanup if needed
  }
}
