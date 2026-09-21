/**
 * UploadForm.js
 * Handles the admin upload panel.
 * - Shows/hides a slide-in form panel
 * - POSTs multipart form data to /api/clicks/upload with the Bearer token
 * - On success, reloads the gallery without a page refresh
 */
export class UploadForm {
  /**
   * @param {{ onUploaded: function }} callbacks
   */
  constructor({ onUploaded } = {}) {
    this.onUploaded = onUploaded || (() => {});

    this._panel   = document.getElementById('upload-panel');
    this._trigger = document.getElementById('upload-trigger');
    this._form    = document.getElementById('upload-form');
    this._status  = document.getElementById('upload-status');
    this._close   = document.getElementById('upload-close');

    if (!this._panel) {
      console.warn('[UploadForm] Missing #upload-panel element');
      return;
    }

    this._bindEvents();
  }

  _bindEvents() {
    this._trigger?.addEventListener('click', () => this.toggle());
    this._close?.addEventListener('click',   () => this.hide());

    this._form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._handleSubmit();
    });
  }

  toggle() { this._panel.classList.toggle('open'); }
  show()   { this._panel.classList.add('open'); }
  hide()   { this._panel.classList.remove('open'); }

  async _handleSubmit() {
    const fileInput    = this._form.querySelector('#photo-file');
    const captionInput = this._form.querySelector('#photo-caption');
    const tokenInput   = this._form.querySelector('#admin-token');
    const submitBtn    = this._form.querySelector('button[type="submit"]');

    const file    = fileInput?.files?.[0];
    const caption = captionInput?.value?.trim() ?? '';
    const token   = tokenInput?.value?.trim() ?? '';

    if (!file) {
      this._setStatus('Please select a photo.', 'error');
      return;
    }
    if (!token) {
      this._setStatus('Admin token is required.', 'error');
      return;
    }

    // Build FormData
    const fd = new FormData();
    fd.append('photo',   file);
    fd.append('caption', caption);

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Uploading…';
    this._setStatus('', '');

    try {
      const res = await fetch('/api/clicks/upload', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });

      const json = await res.json();

      if (!res.ok) {
        this._setStatus(`Error: ${json.error ?? res.status}`, 'error');
        return;
      }

      this._setStatus('✓ Photo uploaded permanently.', 'success');
      this._form.reset();
      this.hide();
      this.onUploaded(json); // trigger gallery reload
    } catch (err) {
      this._setStatus(`Network error: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Upload';
    }
  }

  _setStatus(msg, type) {
    if (!this._status) return;
    this._status.textContent  = msg;
    this._status.className    = `upload-status ${type}`;
  }
}
