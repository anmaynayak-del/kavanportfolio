/**
 * PerformanceMonitor.js
 * Detects device capabilities and user preferences to set the quality tier.
 * Tier: 'high' | 'low' | 'reduced' (reduced = prefers-reduced-motion)
 */
export class PerformanceMonitor {
  constructor() {
    this.isMobile = this._detectMobile();
    this.isTablet = this._detectTablet();
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.tier = 'high';
    this._detect();
  }

  _detectMobile() {
    return window.innerWidth < 481 ||
      /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  _detectTablet() {
    return window.innerWidth >= 481 && window.innerWidth <= 1024 ||
      /iPad|Tablet/i.test(navigator.userAgent);
  }

  _detect() {
    const cores = navigator.hardwareConcurrency || 2;
    const memory = navigator.deviceMemory || 4; // GB, not available in Firefox

    if (this.prefersReducedMotion) {
      this.tier = 'reduced';
    } else if (this.isMobile || cores <= 2 || memory <= 2) {
      this.tier = 'low';
    } else if (this.isTablet || cores <= 4) {
      this.tier = 'medium';
    } else {
      this.tier = 'high';
    }

    console.log(`[PerformanceMonitor] tier=${this.tier} cores=${cores} mem=${memory}GB mobile=${this.isMobile} reduced=${this.prefersReducedMotion}`);
  }

  isHighEnd()    { return this.tier === 'high'; }
  isMediumEnd()  { return this.tier === 'high' || this.tier === 'medium'; }
  isReduced()    { return this.tier === 'reduced'; }

  /** Particle count scaled per tier */
  starCount() {
    return { high: 3000, medium: 1800, low: 800, reduced: 0 }[this.tier] ?? 800;
  }

  /** Max devicePixelRatio per tier */
  maxPixelRatio() {
    return { high: 2, medium: 1.5, low: 1, reduced: 1 }[this.tier] ?? 1;
  }
}
