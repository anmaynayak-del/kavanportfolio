/**
 * QualityManager.js
 * Monitors FPS in real time. If FPS drops below 40 for >2 seconds,
 * fires a downgrade callback to reduce particle count / disable bloom.
 */
export class QualityManager {
  constructor({ onDowngrade, onUpgrade } = {}) {
    this.onDowngrade = onDowngrade || (() => {});
    this.onUpgrade   = onUpgrade   || (() => {});

    this.tier = 'high'; // 'high' | 'low'
    this._frames = 0;
    this._lastTime = performance.now();
    this._fps = 60;
    this._lowStart = null; // timestamp when fps first dipped
    this.LOW_THRESHOLD = 40;
    this.GRACE_MS = 2000;   // must stay low for 2 s before downgrade
  }

  // Call once per animation frame
  tick() {
    this._frames++;
    const now = performance.now();
    const elapsed = now - this._lastTime;

    if (elapsed >= 500) {           // sample every 500 ms
      this._fps = (this._frames / elapsed) * 1000;
      this._frames = 0;
      this._lastTime = now;

      if (this._fps < this.LOW_THRESHOLD) {
        if (this._lowStart === null) this._lowStart = now;
        if (this.tier === 'high' && now - this._lowStart > this.GRACE_MS) {
          this.tier = 'low';
          console.warn(`[QualityManager] FPS=${this._fps.toFixed(1)} — downgrading to LOW tier`);
          this.onDowngrade();
        }
      } else {
        this._lowStart = null; // reset grace period
      }
    }
  }

  getFPS() { return this._fps; }
}
