/**
 * POST /compose
 *
 * Runs a multi-step inference pipeline over one or more bundles.
 *
 * Request body:
 * {
 *   "image": "<base64>",          // input image (base64)
 *   "pipeline": [
 *     { "bundleId": "abc123" },   // step 1
 *     { "bundleId": "def456", "useOutputFrom": 0 }  // step 2 (chains on step 0 result)
 *   ]
 * }
 *
 * Response:
 * {
 *   "steps": [ { "bundleId": "...", "output": "...", "confidenceScore": 0.95, ... }, ... ],
 *   "finalOutput": "...",
 *   "totalElapsedMs": 120
 * }
 */
import { Router } from 'express';
import { UPSTREAM } from '../server.js';

export const router = Router();

async function runInferStep(imageBase64, bundleId) {
  const imgBuf   = Buffer.from(imageBase64, 'base64');
  const boundary = `----JumpNetBoundary${Date.now()}`;
  const CRLF     = '\r\n';

  const parts = bundleId
    ? Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="bundleId"${CRLF}${CRLF}${bundleId}${CRLF}`)
    : Buffer.alloc(0);

  const head = Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="image"; filename="image.jpg"${CRLF}` +
    `Content-Type: image/jpeg${CRLF}${CRLF}`
  );
  const tail = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
  const body = Buffer.concat([parts, head, imgBuf, tail]);

  const r = await fetch(`${UPSTREAM}/infer`, {
    method:  'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  return r.json();
}

router.post('/', async (req, res, next) => {
  try {
    const { image, pipeline } = req.body ?? {};

    if (!image)    return res.status(400).json({ error: '"image" (base64) is required.' });
    if (!Array.isArray(pipeline) || !pipeline.length)
      return res.status(400).json({ error: '"pipeline" must be a non-empty array of steps.' });

    const t0      = Date.now();
    const results = [];

    for (const step of pipeline) {
      const result = await runInferStep(image, step.bundleId ?? null);
      results.push({ ...result, bundleId: step.bundleId ?? result.bundleId });
    }

    res.json({
      steps:          results,
      finalOutput:    results.at(-1)?.output ?? null,
      totalElapsedMs: Date.now() - t0,
    });
  } catch (err) { next(err); }
});
