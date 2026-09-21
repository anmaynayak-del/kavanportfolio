/**
 * Cursor.js
 * Custom smooth trailing cursor.
 */
export class CustomCursor {
  constructor() {
    this.dot = document.getElementById('cursor-dot');
    this.ring = document.getElementById('cursor-ring');
    
    this.target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.dotPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.ringPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    if (!this.dot || !this.ring) return;

    // Hide default cursor
    document.body.style.cursor = 'none';

    window.addEventListener('mousemove', (e) => {
      this.target.x = e.clientX;
      this.target.y = e.clientY;
    });

    // Handle hover states (links, buttons)
    const interactables = document.querySelectorAll('a, button, input');
    interactables.forEach(el => {
      el.addEventListener('mouseenter', () => this.ring.classList.add('hover'));
      el.addEventListener('mouseleave', () => this.ring.classList.remove('hover'));
    });

    this.update = this.update.bind(this);
    requestAnimationFrame(this.update);
  }

  update() {
    if (!this.dot || !this.ring) return;

    // Dot follows instantly/very fast
    this.dotPos.x += (this.target.x - this.dotPos.x) * 0.5;
    this.dotPos.y += (this.target.y - this.dotPos.y) * 0.5;

    // Ring lags behind
    this.ringPos.x += (this.target.x - this.ringPos.x) * 0.15;
    this.ringPos.y += (this.target.y - this.ringPos.y) * 0.15;

    this.dot.style.transform = `translate3d(calc(${this.dotPos.x}px - 50%), calc(${this.dotPos.y}px - 50%), 0)`;
    this.ring.style.transform = `translate3d(calc(${this.ringPos.x}px - 50%), calc(${this.ringPos.y}px - 50%), 0)`;

    requestAnimationFrame(this.update);
  }
}
