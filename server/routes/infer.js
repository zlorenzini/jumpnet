/**
 * POST /infer
 *
 * Accepts multipart (image file) or JSON ({ image: "<base64>" }).
 * Proxies to JumpSmartsRuntime POST /infer and returns the result.
 */
import { Router }  from 'express';
import multer      from 'multer';
import { UPSTREAM } from '../server.js';

export const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── POST /infer  (multipart image) ───────────────────────────────────────────
router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    let body;
    let contentType;

    if (req.file) {
      // Forward raw multipart to upstream
      const boundary = `----JumpNetBoundary${Date.now()}`;
      const CRLF = '\r\n';
      const head = Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="image"; filename="${req.file.originalname ?? 'image.jpg'}"${CRLF}` +
        `Content-Type: ${req.file.mimetype ?? 'image/jpeg'}${CRLF}${CRLF}`
      );
      const tail = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
      const parts = [];
      if (req.body.bundleId) {
        const fieldPart = Buffer.from(
          `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="bundleId"${CRLF}${CRLF}` +
          `${req.body.bundleId}${CRLF}`
        );
        parts.push(fieldPart);
      }
      body = Buffer.concat([...parts, head, req.file.buffer, tail]);
      contentType = `multipart/form-data; boundary=${boundary}`;
    } else if (req.body?.image) {
      // base64 JSON → convert to multipart
      const imgBuf = Buffer.from(req.body.image, 'base64');
      const boundary = `----JumpNetBoundary${Date.now()}`;
      const CRLF = '\r\n';
      const head = Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="image"; filename="image.jpg"${CRLF}` +
        `Content-Type: image/jpeg${CRLF}${CRLF}`
      );
      const tail = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
      body = Buffer.concat([head, imgBuf, tail]);
      contentType = `multipart/form-data; boundary=${boundary}`;
    } else {
      return res.status(400).json({ error: 'Provide an image file (multipart) or { image: "<base64>" }' });
    }

    const upRes = await fetch(`${UPSTREAM}/infer`, {
      method:  'POST',
      headers: { 'Content-Type': contentType },
      body,
    });

    const json = await upRes.json();
    res.status(upRes.status).json(json);
  } catch (err) {
    next(err);
  }
});
