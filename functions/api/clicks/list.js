/**
 * GET /api/clicks/list
 *
 * Returns all photos in chronological insertion order (permanent).
 * No auth required — this is the public gallery feed.
 * Each record includes a signed image URL pointing to the proxy route.
 */
export async function onRequestGet({ request, env, waitUntil }) {
  try {
    const { results } = await env.DB
      .prepare(
        `SELECT id, r2_key, caption, uploaded_at
         FROM clicks
         ORDER BY uploaded_at ASC`  // order is permanent — matches insertion order
      )
      .all();

    // Build the base URL so image proxy links work on any environment
    const origin = new URL(request.url).origin;

    const photos = results.map((row) => ({
      id:          row.id,
      caption:     row.caption,
      uploaded_at: row.uploaded_at,
      // Proxy URL — image content streams through the Worker, R2 stays private
      url: `${origin}/api/clicks/image/${encodeURIComponent(row.r2_key)}`,
    }));

    return new Response(JSON.stringify({ photos }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('List query failed:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch gallery' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
