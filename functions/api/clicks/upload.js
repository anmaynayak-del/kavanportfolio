/**
 * POST /api/clicks/upload
 *
 * Accepts multipart/form-data with:
 *   - photo    : File  (required)  — the image to store in R2
 *   - caption  : string (optional) — immutable caption stored in D1
 *
 * Auth: Authorization: Bearer <ADMIN_TOKEN>
 *
 * No UPDATE / DELETE route exists — intentional by design.
 * Once a photo is inserted it is permanent and immutable.
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function onRequestPost({ request, env }) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return jsonError(401, 'Unauthorized');
  }

  // ── 2. Parse multipart body ────────────────────────────────────────────────
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, 'Expected multipart/form-data');
  }

  const file    = formData.get('photo');
  const caption = (formData.get('caption') ?? '').toString().trim().slice(0, 280);

  if (!(file instanceof File)) {
    return jsonError(400, 'Missing required field: photo');
  }

  // ── 3. Validate ────────────────────────────────────────────────────────────
  if (!ALLOWED_TYPES.includes(file.type)) {
    return jsonError(415, `Unsupported file type: ${file.type}`);
  }

  if (file.size > MAX_BYTES) {
    return jsonError(413, `File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
  }

  // ── 4. Build a unique R2 key ───────────────────────────────────────────────
  const ext    = file.type.split('/')[1].replace('jpeg', 'jpg');
  const uuid   = crypto.randomUUID();
  const r2Key  = `clicks/${uuid}.${ext}`;

  // ── 5. Write to R2 ────────────────────────────────────────────────────────
  try {
    await env.PORTFOLIO_IMAGES.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { caption, uploadedBy: 'admin' },
    });
  } catch (err) {
    console.error('R2 put failed:', err);
    return jsonError(502, 'Failed to store image');
  }

  // ── 6. Write to D1 (append-only INSERT) ───────────────────────────────────
  try {
    await env.DB
      .prepare(
        `INSERT INTO clicks (id, r2_key, caption, uploaded_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(uuid, r2Key, caption)
      .run();
  } catch (err) {
    // D1 write failed — delete the orphaned R2 object to stay consistent
    console.error('D1 insert failed:', err);
    await env.PORTFOLIO_IMAGES.delete(r2Key).catch(() => {});
    return jsonError(502, 'Failed to save photo metadata');
  }

  // ── 7. Return the new record ───────────────────────────────────────────────
  return jsonOk(201, {
    id: uuid,
    r2_key: r2Key,
    caption,
    uploaded_at: new Date().toISOString(),
  });
}

// ── Only POST is handled — no PUT, PATCH, DELETE routes exist ─────────────────
// Any other HTTP method on this path returns 405.
export async function onRequest({ request }) {
  if (request.method !== 'POST') {
    return jsonError(405, 'Method Not Allowed');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function jsonOk(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders({ 'Content-Type': 'application/json' }),
  });
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: corsHeaders({ 'Content-Type': 'application/json' }),
  });
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    ...extra,
  };
}
