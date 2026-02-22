/**
 * server/lib/delegate.js
 *
 * Optional GPU delegation helper.
 *
 * If GPU_HELPER_URL is set (e.g. "http://ZW8:4080"), every call to
 * tryDelegate() will:
 *  1. Probe helper's GET /capabilities
 *  2. If helper.compute.gpu === "available", forward the request there
 *  3. Return the helper's JSON response, or null if delegation is skipped
 *
 * Routes call this before running locally, so if a dedicated GPU node is
 * available it handles the heavy lifting.
 *
 * GPU_HELPER_URL=http://ZW8:4080  node server.js      # on ZL1 (orchestrator)
 * (unset)                                              # on ZW8 (worker) — runs locally
 */

const HELPER_URL   = process.env.GPU_HELPER_URL ?? null;
const TIMEOUT_MS   = 5_000;

/**
 * Attempt to delegate a route to a GPU helper node.
 *
 * @param {string} route    e.g. '/train'  or  '/infer'
 * @param {object} body     original request body (may be undefined for GET)
 * @param {Buffer|null} [fileBuffer]  raw upload buffer for multipart routes
 * @returns {Promise<object|null>}   parsed JSON from helper, or null to run locally
 */
export async function tryDelegate(route, body, fileBuffer = null) {
  if (!HELPER_URL) return null;

  try {
    // ── 1. Check helper capabilities ────────────────────────────────────
    const capsRes = await fetch(`${HELPER_URL}/capabilities`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!capsRes.ok) return null;

    const caps = await capsRes.json();
    if (caps.compute?.gpu !== 'available') return null;

    // ── 2. Forward the request ───────────────────────────────────────────
    let forwardRes;

    if (fileBuffer) {
      // Multipart — rebuild simple multipart body
      const boundary = `----JumpNetDelegate${Date.now()}`;
      const CRLF     = '\r\n';
      const bHead    = Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="image"; filename="image.jpg"${CRLF}` +
        `Content-Type: image/jpeg${CRLF}${CRLF}`
      );
      const bTail    = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
      const payload  = Buffer.concat([bHead, fileBuffer, bTail]);

      forwardRes = await fetch(`${HELPER_URL}${route}`, {
        method:  'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body:    payload,
        signal:  AbortSignal.timeout(120_000),
      });
    } else {
      forwardRes = await fetch(`${HELPER_URL}${route}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body ?? {}),
        signal:  AbortSignal.timeout(120_000),
      });
    }

    if (!forwardRes.ok) {
      const text = await forwardRes.text();
      throw new Error(`Helper ${route} returned ${forwardRes.status}: ${text}`);
    }

    const result = await forwardRes.json();
    return { ...result, _delegatedTo: HELPER_URL };
  } catch (err) {
    // Log and fall through to local execution
    console.warn(`[delegate] Could not reach ${HELPER_URL}${route}: ${err.message}`);
    return null;
  }
}
