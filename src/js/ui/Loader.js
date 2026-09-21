import * as THREE from 'three';

/**
 * GlobalLoader.js — Full-screen loading overlay.
 * Replaced the circle with a straight progress bar and a sequence 
 * that jumps through 3 to 4 random numbers, taking about 2 seconds total, 
 * before hitting 100% and hiding.
 */
export class GlobalLoader {
  constructor(onComplete) {
    this.loaderEl   = document.getElementById('global-loader');
    this.onComplete = onComplete;
    this.isDone     = false;

    // Build richer loader UI
    this._build();

    // Prevent Three.js DefaultLoadingManager from interfering with our custom timed animation
    // We will just run our sequence immediately.
    this._runSequence();
  }

  _build() {
    if (!this.loaderEl) return;
    this.loaderEl.innerHTML = `
      <div class="loader-content">
        <div class="loader-percent">0%</div>
        <div class="loader-bar-container">
          <div class="loader-bar-fill"></div>
        </div>
        <p class="loader-text">INITIALIZING ENVIRONMENT...</p>
      </div>
    `;
    this._fillEl    = this.loaderEl.querySelector('.loader-bar-fill');
    this._percentEl = this.loaderEl.querySelector('.loader-percent');
  }

  _runSequence() {
    // Generate 3 random jumps before 100
    const step1 = Math.floor(Math.random() * 15) + 15; // 15-30
    const step2 = Math.floor(Math.random() * 20) + 40; // 40-60
    const step3 = Math.floor(Math.random() * 15) + 75; // 75-90

    const sequence = [
      { time: 0,    val: 0 },
      { time: 400,  val: step1 },
      { time: 900,  val: step2 },
      { time: 1400, val: step3 },
      { time: 2000, val: 100 }
    ];

    sequence.forEach(step => {
      setTimeout(() => {
        if (this.isDone) return;
        this._updateProgress(step.val);
        
        if (step.val === 100) {
          setTimeout(() => this.finish(), 300);
        }
      }, step.time);
    });

    // Fallback: force finish after 3s
    setTimeout(() => { if (!this.isDone) this.finish(); }, 3500);
  }

  _updateProgress(p) {
    if (this._percentEl) this._percentEl.textContent = `${p}%`;
    if (this._fillEl)    this._fillEl.style.width = `${p}%`;
  }

  finish() {
    if (this.isDone || !this.loaderEl) return;
    this.isDone = true;
    
    this._updateProgress(100);

    setTimeout(() => {
      this.loaderEl.style.opacity = '0';
      setTimeout(() => {
        this.loaderEl.style.display = 'none';
        if (this.onComplete) this.onComplete();
      }, 800);
    }, 200);
  }
}
