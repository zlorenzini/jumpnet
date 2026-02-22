/**
 * server/routes/infer.js
 *
 * POST /infer
 *
 * Accepts:
 *   - multipart/form-data  with field "image" (image file)
 *   - JSON { image: "<base64>" }
 *   - JSON { imageId: "<dataset>/<label>/<filename>" }
 *
 * Runs local MobileNetV2 inference via server/ml/infer.py.
 * Falls back with a clear error if no model is trained yet.
 *
 * Optional: if GPU_HELPER_URL is set and that node advertises a GPU,
 * the request is delegated there first.
 */
import { Router }            from 'express';
import multer                from 'multer';
import { fileURLToPath }     from 'node:url';
import { join }              from 'node:path';
import { existsSync }        from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID }        from 'node:crypto';
import { tmpdir }            from 'node:os';
import { getImagePath }      from '../localDatastore.js';
import { runInfer }          from '../mlRunner.js';
import { tryDelegate }       from '../lib/delegate.js';

const router    = Router();
const upload    = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const MODEL_DIR = fileURLToPath(new URL('../../models/current', import.meta.url));

router.post('/', upload.single('image'), async (req, res, next) => {
  let tmpPath = null;
  try {
    // ── Optional delegation ───────────────────────────────────────────────
    if (process.env.GPU_HELPER_URL) {
      const delegated = await tryDelegate('/infer', req.body, req.file?.buffer ?? null);
      if (delegated !== null) return res.json(delegated);
    }

    // ── Model presence check ──────────────────────────────────────────────
    const modelPth = join(MODEL_DIR, 'model.pth');
    if (!existsSync(modelPth)) {
      return res.status(503).json({
        error:    'No trained model found.',
        hint:     'POST /train with a datasetId to train a model first.',
        modelDir: MODEL_DIR,
      });
    }

    // ── Resolve image ─────────────────────────────────────────────────────
    let imagePath = null;

    if (req.file) {
      tmpPath   = join(tmpdir(), `jumpnet_infer_${randomUUID()}.jpg`);
      await writeFile(tmpPath, req.file.buffer);
      imagePath = tmpPath;
    } else if (req.body?.imageId) {
      const parts = req.body.imageId.split('/');
      if (parts.length < 3) {
        return res.status(400).json({ error: 'imageId must be "dataset/label/filename"' });
      }
      const [dataset, label, ...rest] = parts;
      const filename = rest.join('/');
      imagePath = getImagePath(dataset, label, filename);
      if (!imagePath) {
        return res.status(404).json({ error: `Image not found: ${req.body.imageId}` });
      }
    } else if (req.body?.image) {
      const b64  = req.body.image.split(',').at(-1);
      const buf  = Buffer.from(b64, 'base64');
      tmpPath    = join(tmpdir(), `jumpnet_infer_${randomUUID()}.jpg`);
      await writeFile(tmpPath, buf);
      imagePath  = tmpPath;
    } else {
      return res.status(400).json({
        error: 'Provide multipart "image", JSON { image: "<base64>" }, or JSON { imageId: "dataset/label/file" }',
      });
    }

    const result = await runInfer({ imagePath, modelDir: MODEL_DIR });
    res.json(result);
  } catch (err) {
    next(err);
  } finally {
    if (tmpPath) unlink(tmpPath).catch(() => {});
  }
});

export { router };
