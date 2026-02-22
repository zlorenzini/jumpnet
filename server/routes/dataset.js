/**
 * /dataset  — proxies all dataset operations to JumpSmartsRuntime.
 *
 *   GET  /dataset/list
 *   GET  /dataset/:name
 *   POST /dataset/upload          (multipart: file, dataset, label)
 *   DELETE /dataset/:name/:label/:filename
 *   GET  /dataset/:name/image/:label/:filename
 */
import { Router } from 'express';
import multer     from 'multer';
import { UPSTREAM } from '../server.js';

export const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── GET /dataset/list ─────────────────────────────────────────────────────────
router.get('/list', async (_req, res, next) => {
  try {
    const r = await fetch(`${UPSTREAM}/dataset/list`);
    res.status(r.status).json(await r.json());
  } catch (err) { next(err); }
});

// ── GET /dataset/:name ────────────────────────────────────────────────────────
router.get('/:name', async (req, res, next) => {
  try {
    const r = await fetch(`${UPSTREAM}/dataset/${encodeURIComponent(req.params.name)}`);
    res.status(r.status).json(await r.json());
  } catch (err) { next(err); }
});

// ── POST /dataset/upload ──────────────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Multipart field "file" is required.' });
    const { dataset, label } = req.body;
    if (!dataset || !label) return res.status(400).json({ error: '"dataset" and "label" fields are required.' });

    const boundary = `----JumpNetBoundary${Date.now()}`;
    const CRLF = '\r\n';

    const makeField = (name, value) =>
      Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`);

    const fileHead = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${req.file.originalname ?? 'image.jpg'}"${CRLF}` +
      `Content-Type: ${req.file.mimetype ?? 'image/jpeg'}${CRLF}${CRLF}`
    );
    const tail = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);

    const body = Buffer.concat([makeField('dataset', dataset), makeField('label', label), fileHead, req.file.buffer, tail]);

    const r = await fetch(`${UPSTREAM}/dataset/upload`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    res.status(r.status).json(await r.json());
  } catch (err) { next(err); }
});

// ── DELETE /dataset/:name/:label/:filename ────────────────────────────────────
router.delete('/:name/:label/:filename', async (req, res, next) => {
  try {
    const { name, label, filename } = req.params;
    const r = await fetch(
      `${UPSTREAM}/dataset/${encodeURIComponent(name)}/${encodeURIComponent(label)}/${encodeURIComponent(filename)}`,
      { method: 'DELETE' }
    );
    r.status === 204 ? res.sendStatus(204) : res.status(r.status).json(await r.json());
  } catch (err) { next(err); }
});

// ── GET /dataset/:name/image/:label/:filename ─────────────────────────────────
router.get('/:name/image/:label/:filename', async (req, res, next) => {
  try {
    const { name, label, filename } = req.params;
    const r = await fetch(
      `${UPSTREAM}/dataset/${encodeURIComponent(name)}/image/${encodeURIComponent(label)}/${encodeURIComponent(filename)}`
    );
    if (!r.ok) return res.status(r.status).end();
    const buf  = Buffer.from(await r.arrayBuffer());
    const mime = r.headers.get('content-type') ?? 'image/jpeg';
    res.setHeader('Content-Type', mime).send(buf);
  } catch (err) { next(err); }
});
