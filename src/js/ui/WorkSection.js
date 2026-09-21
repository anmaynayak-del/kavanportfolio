/**
 * WorkSection.js
 * Fetches projects.json and renders them as 3D floating cards.
 * Uses IntersectionObserver to trigger the float-in entrance animation.
 */
export class WorkSection {
  constructor() {
    this._grid = document.getElementById('projects-grid');
    if (!this._grid) {
      console.warn('[WorkSection] Missing #projects-grid element in DOM');
      return;
    }
    
    // Observer for scroll-triggered entrance animations
    this._observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Optional: stop observing once it has animated in
          // this._observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    });
  }

  async load() {
    try {
      const res = await fetch('/projects.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const projects = await res.json();
      
      this._render(projects);
    } catch (err) {
      console.warn('[WorkSection] Could not load projects.json:', err.message);
      this._grid.innerHTML = `<p style="opacity: 0.5;">No projects found.</p>`;
    }
  }

  _render(projects) {
    this._grid.innerHTML = ''; // clear existing
    
    projects.forEach((proj, index) => {
      // The outer wrapper handles the scroll-in entrance animation
      const wrapper = document.createElement('div');
      wrapper.className = 'project-card-wrapper';
      wrapper.style.transitionDelay = `${(index % 4) * 0.15}s`;
      
      // The inner card handles the continuous anti-gravity drift
      const card = document.createElement('a');
      card.className = 'project-card';
      card.href = proj.link;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      // Stagger the drift animation so they don't all float in unison
      card.style.animationDelay = `${(index % 4) * -1.5}s`;
      
      const tagsHtml = (proj.tags || [])
        .map(tag => `<span class="tag">${tag}</span>`)
        .join('');
        
      card.innerHTML = `
        <div class="card-content">
          <h3>${proj.title}</h3>
          <p>${proj.description}</p>
          <div class="tags">${tagsHtml}</div>
        </div>
      `;
      
      wrapper.appendChild(card);
      this._grid.appendChild(wrapper);
      
      // Observe the wrapper for scroll entrance
      this._observer.observe(wrapper);
    });
  }
}
