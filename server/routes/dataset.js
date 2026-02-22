/**
 * /dataset  — local-first dataset management.
 *
 * All reads/writes go to DATA_DIR/datasets/ (see localDatastore.js).
 * No upstream dependency required.
 *
 *   GET    /dataset/list
 *   GET    /dataset/:name
 *   POST   /dataset/upload          multipart (file, dataset, label) OR JSON ({ image: base64, dataset, label })
 *   DELETE /dataset/:name/:label/:filename
 *   GET    /dataset/:name/image/:label/:filename
 */
import { Router }    from 'express';
import multer        from 'multer';
import { extname }   from 'node:path';
import {
  saveImage,
  listDatasets,
  getDataset,
  deleteImage,
  getImagePath,
  createReadStream,
} from '../localDatastore.js';

export const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Mime → extension map for base64 uploads
const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// ── GET /dataset/list ─────────────────────────────────────────────────────────
router.get('/list', async (_req, res, next) => {
  try {
    res.json(await listDatasets());
  } catch (err) { next(err); }
});

// ── GET /dataset/:name ────────────────────────────────────────────────────────
router.get('/:name', async (req, res, next) => {
  try {
    const data = await getDataset(req.params.name);
    data ? res.json(data) : res.status(404).json({ error: 'Dataset not found.' });
  } catch (err) { next(err); }
});

// ── POST /dataset/upload ──────────────────────────────────────────────────────
// Accepts multipart/form-data  (fields: file, dataset, label)
//      OR application/json     (fields: image[base64], dataset, label)
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const dataset = (req.body?.dataset ?? '').trim();
    const label   = (req.body?.label   ?? '').trim();

    if (!dataset) return res.status(400).json({ error: '"dataset" field is required.' });
    if (!label)   return res.status(400).json({ error: '"label" field is required.' });

    let imageBuffer, originalName;

    if (req.file) {
      // ── multipart file ──────────────────────────────────────────────────────
      imageBuffer  = req.file.buffer;
      originalName = req.file.originalname ?? `upload${MIME_EXT[req.file.mimetype] ?? '.jpg'}`;
    } else if (req.body?.image) {
      // ── JSON base64 ─────────────────────────────────────────────────────────
      const raw   = req.body.image.replace(/^data:[^;]+;base64,/, ''); // strip data-URI prefix if present
      imageBuffer  = Buffer.from(raw, 'base64');
      originalName = req.body.filename ?? '.jpg';
    } else {
      return res.status(400).json({
        error: 'Provide an image file via multipart "file" field or JSON "image" (base64).',
      });
    }

    const result = await saveImage({ dataset, label, imageBuffer, originalName });

    res.status(201).json({ status: 'ok', ...result });
  } catch (err) { next(err); }
});

// ── DELETE /dataset/:name/:label/:filename ────────────────────────────────────
router.delete('/:name/:label/:filename', async (req, res, next) => {
  try {
    const { name, label, filename } = req.params;
    const deleted = await deleteImage(name, label, filename);
    deleted ? res.sendStatus(204) : res.status(404).json({ error: 'File not found.' });
  } catch (err) { next(err); }
});

// ── GET /dataset/:name/image/:label/:filename ─────────────────────────────────
router.get('/:name/image/:label/:filename', (req, res, next) => {
  try {
    const { name, label, filename } = req.params;
    const filePath = getImagePath(name, label, filename);
    if (!filePath) return res.status(404).json({ error: 'Image not found.' });

    const ext  = extname(filename).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});
