/**
 * server/routes/infer.js
 *
 * POST /infer
 *
 * Accepts:
 *   - multipart/form-data  with field "image" (image file) + optional "bundleId"
 *   - JSON { image: "<base64>", bundleId?: string }
 *   - JSON { imageId: "<dataset>/<label>/<filename>", bundleId?: string }
 *
 * Converts the image to base64 and proxies to JumpSmartsRuntime (port 7312).
 *
 * Optional: if GPU_HELPER_URL is set and that node advertises a GPU,
 * the request is delegated there first.
 */
import { Router }   from 'express';
import multer       from 'multer';
import { readFile } from 'node:fs/promises';
import { UPSTREAM } from '../server.js';
import { getImagePath } from '../localDatastore.js';
import { tryDelegate }  from '../lib/delegate.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    // ── Optional delegation ───────────────────────────────────────────────
    if (process.env.GPU_HELPER_URL) {
      const delegated = await tryDelegate('/infer', req.body, req.file?.buffer ?? null);
      if (delegated !== null) return res.json(delegated);
    }

    // ── Resolve image → base64 ────────────────────────────────────────────
    let imageBase64 = null;

    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
    } else if (req.body?.imageId) {
      const parts = req.body.imageId.split('/');
      if (parts.length < 3) {
        return res.status(400).json({ error: 'imageId must be "dataset/label/filename"' });
      }
      const [dataset, label, ...rest] = parts;
      const filePath = getImagePath(dataset, label, rest.join('/'));
      if (!filePath) {
        return res.status(404).json({ error: `Image not found: ${req.body.imageId}` });
      }
      imageBase64 = (await readFile(filePath)).toString('base64');
    } else if (req.body?.image) {
      imageBase64 = req.body.image.split(',').at(-1);
    } else {
      return res.status(400).json({
        error: 'Provide multipart "image", JSON { image: "<base64>" }, or JSON { imageId: "dataset/label/file" }',
      });
    }

    // ── Proxy to JumpSmartsRuntime ────────────────────────────────────────
    const r = await fetch(`${UPSTREAM}/infer`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ imageBase64, bundleId: req.body?.bundleId ?? 'current' }),
      signal:  AbortSignal.timeout(60_000),
    });

    let data;
    try {
      data = await r.json();
    } catch {
      const text = await r.text();
      data = { error: text || 'Upstream returned a non-JSON response' };
    }
    res.status(r.status).json(data);
  } catch (err) {
    next(err);
  }
});

export { router };
