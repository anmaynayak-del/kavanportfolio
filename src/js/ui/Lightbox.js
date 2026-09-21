/**
 * Lightbox.js
 * Full-screen overlay that shows a single photo + caption.
 * Opens/closes with animation, closes on Escape or backdrop click.
 */
export class Lightbox {
  constructor() {
    this._el    = document.getElementById('lightbox');
    this._img   = document.getElementById('lightbox-img');
    this._vid   = document.getElementById('lightbox-video');
    this._cap   = document.getElementById('lightbox-caption');
    this._close = document.getElementById('lightbox-close');

    if (!this._el) {
      console.error('[Lightbox] Missing #lightbox element in DOM');
      return;
    }

    this._bindEvents();
  }

  open(url, caption, isVideo = false) {
    if (!this._el) return;
    
    if (isVideo) {
      this._img.style.display = 'none';
      this._vid.style.display = 'block';
      this._vid.src = url;
      this._vid.play();
      this._el.style.background = 'rgba(16,20,0,0.95)'; // Deep theater dark green
    } else {
      this._vid.style.display = 'none';
      this._img.style.display = 'block';
      this._img.src = url;
      this._vid.pause();
    }
    
    this._cap.textContent = caption || '';
    this._el.classList.add('open');
    document.body.style.cursor = 'auto';
  }

  close() {
    if (!this._el) return;
    this._el.classList.remove('open');
    if (this._vid) this._vid.pause();
  }

  isOpen() {
    return this._el?.classList.contains('open') ?? false;
  }

  _bindEvents() {
    // Close button
    this._close?.addEventListener('click', () => this.close());

    // Backdrop click (not the image itself)
    this._el.addEventListener('click', (e) => {
      if (e.target === this._el) this.close();
    });

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }
}
