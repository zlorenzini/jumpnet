/**
 * POST /embed
 *
 * Generates a vector embedding for text (or image).
 * Currently a local stub — extend to call an embedding model endpoint.
 *
 * Request body:
 *   { "text": "...", "model": "optional-model-id" }
 *
 * Response:
 *   { "embedding": [0.1, 0.2, ...], "dimensions": 128, "model": "..." }
 */
import { Router } from 'express';

export const router = Router();

// Deterministic stub: hash text → float32 vector (replace with real model call)
function stubEmbed(text, dims = 128) {
  const vec = new Array(dims);
  for (let i = 0; i < dims; i++) {
    let h = 0;
    for (let j = 0; j < text.length; j++) {
      h = ((h << 5) - h + text.charCodeAt(j) + i * 31) | 0;
    }
    vec[i] = ((h & 0xffff) / 0xffff) * 2 - 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => Math.round((v / norm) * 1e6) / 1e6);
}

router.post('/', (req, res) => {
  const { text, model = 'jumpnet-stub-v0', dimensions = 128 } = req.body ?? {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Body must contain a "text" string.' });
  }

  const dims = Math.min(Math.max(parseInt(dimensions) || 128, 8), 2048);
  const embedding = stubEmbed(text, dims);

  res.json({
    embedding,
    dimensions: dims,
    model,
    inputLength: text.length,
  });
});
