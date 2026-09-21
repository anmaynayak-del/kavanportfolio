/**
 * GET /api/clicks/image/[key]
 *
 * Streams an image from R2 to the client.
 * The key is URL-encoded when stored; we decode it before the R2 lookup.
 *
 * Long cache headers are safe because R2 keys are UUIDs —
 * the same key will always serve the same immutable image.
 */
export async function onRequestGet({ params, env }) {
  const r2Key = decodeURIComponent(params.key);

  if (!r2Key || r2Key.includes('..')) {
    return new Response('Bad Request', { status: 400 });
  }

  let object;
  try {
    object = await env.PORTFOLIO_IMAGES.get(r2Key);
  } catch (err) {
    console.error('R2 get failed:', err);
    return new Response('Storage error', { status: 502 });
  }

  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year — immutable
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(object.body, { status: 200, headers });
}
