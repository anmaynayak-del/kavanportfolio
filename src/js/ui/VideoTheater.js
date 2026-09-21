/**
 * VideoTheater.js — Cinematic scroll-driven video experience.
 *
 * Trigger: IntersectionObserver on #video-theater-trigger sentinel (placed
 *          after the "FOR MORE PICS CLICK HERE" button).
 *
 * Flow:
 *  scroll past button → Video 1 rushes in → fills screen → plays
 *  scroll (down) → Video 2 rushes in → fills screen → plays
 *  scroll → footer revealed, continue normally
 */
export class VideoTheater {
  constructor() {
    this._videos = [
      { url: '/lv_0_20260719193006.mp4', title: 'Creative Project 1' },
      { url: '/lv_0_20260908072123.mp4', title: 'Creative Project 2' },
    ];

    this._currentIndex = -1;
    this._active       = false;
    this._animating    = false;
    this._triggered    = false;
    this._skipReady    = false; // only allow skip AFTER video is playing

    this._scrollAccum = 0;
    this._SKIP_THRESH = 60;
    this._touchStartY = 0;

    this._overlay = null;
    this._videoEl = null;
    this._titleEl = null;
    this._muteBtn = null;

    // Hide footer until theater ends
    const footer = document.getElementById('site-footer');
    if (footer) footer.style.display = 'none';

    this._buildDOM();
    this._setupTrigger();
  }

  // ── Build overlay DOM ──────────────────────────────────────────────────────

  _buildDOM() {
    const overlay = document.createElement('div');
    overlay.id = 'video-theater';
    overlay.innerHTML = `
      <div class="vt-inner">
        <video class="vt-video" playsinline muted></video>
        <div class="vt-title"></div>
        <button class="vt-audio-btn" title="Toggle sound">🔇</button>
      </div>
    `;
    document.body.appendChild(overlay);

    this._overlay = overlay;
    this._videoEl = overlay.querySelector('.vt-video');
    this._titleEl = overlay.querySelector('.vt-title');
    this._muteBtn = overlay.querySelector('.vt-audio-btn');

    this._muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._videoEl.muted = !this._videoEl.muted;
      this._muteBtn.textContent = this._videoEl.muted ? '🔇' : '🔊';
    });
  }

  // ── Trigger: sentinel IntersectionObserver ─────────────────────────────────

  _setupTrigger() {
    const sentinel = document.getElementById('video-theater-trigger');
    if (!sentinel) {
      console.error('[VideoTheater] #video-theater-trigger not found!');
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !this._triggered) {
          this._triggered = true;
          io.disconnect();
          this._startTheater();
        }
      });
    }, { threshold: 0.5 });

    io.observe(sentinel);
  }

  // ── Start ──────────────────────────────────────────────────────────────────

  _startTheater() {
    this._active = true;
    this._lockScroll();
    this._playVideo(0);

    // Bind skip handlers
    this._boundWheel      = this._onWheel.bind(this);
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchEnd   = this._onTouchEnd.bind(this);

    window.addEventListener('wheel',      this._boundWheel,      { passive: false });
    window.addEventListener('touchstart', this._boundTouchStart, { passive: true });
    window.addEventListener('touchend',   this._boundTouchEnd,   { passive: true });
  }

  // ── Skip handlers ──────────────────────────────────────────────────────────

  _onWheel(e) {
    e.preventDefault();
    if (!this._skipReady || this._animating) return;
    if (e.deltaY > 0) {
      this._scrollAccum += e.deltaY;
      if (this._scrollAccum >= this._SKIP_THRESH) {
        this._scrollAccum = 0;
        this._advanceVideo();
      }
    }
  }

  _onTouchStart(e) {
    this._touchStartY = e.touches[0].clientY;
  }

  _onTouchEnd(e) {
    if (!this._skipReady || this._animating) return;
    if ((this._touchStartY - e.changedTouches[0].clientY) > 60) {
      this._advanceVideo();
    }
  }

  // ── Advance ────────────────────────────────────────────────────────────────

  _advanceVideo() {
    if (this._animating) return;
    const next = this._currentIndex + 1;
    if (next >= this._videos.length) {
      this._endTheater();
    } else {
      this._animating  = true;
      this._skipReady  = false;
      this._videoEl.pause();

      // Collapse current
      this._overlay.classList.remove('vt-fullscreen');
      this._overlay.classList.add('vt-exit');

      setTimeout(() => {
        this._overlay.classList.remove('vt-exit');
        this._playVideo(next);
      }, 700);
    }
  }

  // ── Play ───────────────────────────────────────────────────────────────────

  _playVideo(index) {
    this._animating    = true;
    this._skipReady    = false;
    this._currentIndex = index;
    const data         = this._videos[index];

    // Set source
    this._videoEl.src   = data.url;
    this._videoEl.muted = true;
    this._titleEl.textContent = data.title;
    this._muteBtn.textContent = '🔇';

    // Show overlay in small "card" state
    this._overlay.classList.remove('vt-fullscreen', 'vt-exit');
    this._overlay.classList.add('vt-visible');

    // rAF to ensure browser paints small state, THEN animate to fullscreen
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._overlay.classList.add('vt-fullscreen');

        // After transition, start video
        setTimeout(() => {
          this._animating = false;
          this._videoEl.load();
          this._videoEl.play()
            .then(() => {
              this._skipReady = true; // now user can skip
            })
            .catch(err => {
              console.warn('[VideoTheater] Autoplay blocked:', err);
              this._skipReady = true;
            });
        }, 1100); // matches CSS transition duration
      });
    });
  }

  // ── End ────────────────────────────────────────────────────────────────────

  _endTheater() {
    this._animating = true;
    this._skipReady = false;
    this._videoEl.pause();

    this._overlay.classList.remove('vt-fullscreen');
    this._overlay.classList.add('vt-exit');

    setTimeout(() => {
      this._overlay.classList.remove('vt-visible', 'vt-exit');
      this._active    = false;
      this._animating = false;
      this._unlockScroll();

      // Remove skip listeners
      window.removeEventListener('wheel',      this._boundWheel);
      window.removeEventListener('touchstart', this._boundTouchStart);
      window.removeEventListener('touchend',   this._boundTouchEnd);

      // Reveal footer
      const footer = document.getElementById('site-footer');
      if (footer) {
        footer.style.display = '';
        setTimeout(() => footer.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }, 700);
  }

  // ── Scroll lock ────────────────────────────────────────────────────────────

  _lockScroll() {
    this._savedY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top      = `-${this._savedY}px`;
    document.body.style.width    = '100%';
  }

  _unlockScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top      = '';
    document.body.style.width    = '';
    window.scrollTo(0, this._savedY || 0);
  }
}
