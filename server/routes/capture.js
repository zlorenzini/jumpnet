/**
 * server/routes/capture.js
 *
 * POST /capture
 *
 * Captures a single frame from the local camera via ffmpeg, then either:
 *   • (default) runs inference against JumpSmartsRuntime (port 7312), or
 *   • (imageOnly: true) returns only the captured image as base64 so the
 *     caller can perform its own inference locally.
 *
 * Optional body (JSON):
 *   bundleId     string   model bundle to use (default: "current")
 *   imageOnly    boolean  skip inference, return image_b64 only (default: false)
 *   device       string   v4l2 device         (default: "/dev/video0")
 *   resolution   string   WxH                 (default: "960x720")
 *   fps          number   framerate hint       (default: auto — 30 for mjpeg, 10 for yuyv422)
 *   warmup       number   frames to discard for AE/AWB settle (default: 10)
 *   inputFormat  string   v4l2 pixel format: "mjpeg" or "yuyv422" (default: "yuyv422")
 *                         yuyv422 = uncompressed raw; JPEG encoding is done in software
 *                         at high quality. Note: at 960x720, YUYV tops out at 15 fps.
 *   jpegQuality  number   output JPEG quality 1–31, lower = better (default: 2 for
 *                         yuyv422, not applied for mjpeg which passes frames through)
 */

import { Router }  from 'express';
import { exec }    from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream } from 'node:fs';
import { UPSTREAM } from '../server.js';

const execAsync = promisify(exec);
const router    = Router();

// Native max fps for YUYV at each resolution (USB bandwidth limited).
// If the requested fps exceeds the raw limit the driver silently caps it, but
// being explicit avoids a ffmpeg negotiation delay.
const YUYV_MAX_FPS = {
  '2304x1536': 2,  '2304x1296': 2,
  '1920x1080': 5,  '1600x896': 5,
  '1280x720':  10, '1024x576': 15,
  '960x720':   15, '864x480':  24,
  '800x600':   24, '800x448':  30,
  '640x480':   30, '640x360':  30,
};

const DEFAULTS = {
  device:      '/dev/video0',
  resolution:  '960x720',
  inputFormat: 'yuyv422',
  warmup:      10,   // frames captured before the keeper — lets AE/AWB settle
  capturePath: '/tmp/jumpnet_capture.jpg',
};

// Input validation: only allow safe, known format strings
const ALLOWED_FORMATS = new Set(['mjpeg', 'yuyv422']);

router.post('/', async (req, res, next) => {
  try {
    const device      = req.body?.device      ?? DEFAULTS.device;
    const resolution  = req.body?.resolution  ?? DEFAULTS.resolution;
    const inputFormat = (req.body?.inputFormat ?? DEFAULTS.inputFormat).toLowerCase();
    const warmup      = Math.max(1, parseInt(req.body?.warmup ?? DEFAULTS.warmup));
    const capturePath = DEFAULTS.capturePath;

    if (!ALLOWED_FORMATS.has(inputFormat)) {
      return res.status(400).json({ error: `Unsupported inputFormat "${inputFormat}". Use "mjpeg" or "yuyv422".` });
    }

    // For raw YUYV: clamp fps to the native USB-bandwidth limit for this resolution;
    // for MJPEG: camera compresses on-chip so 30 fps is available up to 1280×720.
    const rawMaxFps = YUYV_MAX_FPS[resolution] ?? 10;
    const defaultFps = inputFormat === 'yuyv422' ? rawMaxFps : 30;
    const fps = Math.min(
      parseInt(req.body?.fps ?? defaultFps),
      inputFormat === 'yuyv422' ? rawMaxFps : 60,
    );

    // Output JPEG quality (1=best, 31=worst). Only meaningful when ffmpeg is
    // encoding the frame (i.e. raw YUYV input). For MJPEG the camera-encoded
    // JPEG frames pass through unchanged regardless of -q:v.
    const jpegQuality = Math.min(31, Math.max(1,
      parseInt(req.body?.jpegQuality ?? (inputFormat === 'yuyv422' ? 2 : 6)),
    ));

    // ── Capture frame ─────────────────────────────────────────────────────────
    // Capture (warmup + 1) frames with -update 1 so ffmpeg overwrites the
    // same file on every frame.  The camera's AE/AWB settles over the warmup
    // frames; the final write is the correctly-exposed keeper.
    const cmd = [
      'ffmpeg',
      '-f v4l2',
      `-input_format ${inputFormat}`,
      `-video_size ${resolution}`,
      `-framerate ${fps}`,
      `-i ${device}`,
      `-frames:v ${warmup + 1}`,
      '-update 1',
      `-q:v ${jpegQuality}`,
      `-y ${capturePath}`,
      '-loglevel error',
    ].join(' ');

    const imageOnly = req.body?.imageOnly === true || req.body?.imageOnly === 'true';
    const bundleId  = req.body?.bundleId ?? 'current';

    const start = Date.now();
    await execAsync(cmd);
    const latency = Date.now() - start;

    const { readFile } = await import('node:fs/promises');
    const imageBuffer  = await readFile(capturePath);

    // ── imageOnly mode: return the frame without running inference ────────────
    if (imageOnly) {
      return res.json({
        device,
        resolution,
        input_format: inputFormat,
        fps,
        warmup,
        latency_ms: latency,
        image_b64:  imageBuffer.toString('base64'),
        mime_type:  'image/jpeg',
      });
    }

    // ── Forward to JumpSmartsRuntime via multipart ────────────────────────────
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

    const form = new FormData();
    form.append('image',    blob, 'capture.jpg');
    form.append('bundleId', bundleId);

    const r = await fetch(`${UPSTREAM}/infer`, {
      method: 'POST',
      body:   form,
      signal: AbortSignal.timeout(60_000),
    });

    const inference = await r.json();

    res.json({
      device,
      resolution,
      input_format: inputFormat,
      fps,
      warmup,
      latency_ms:  latency,
      image_path:  capturePath,
      inference,
    });
  } catch (err) {
    next(err);
  }
});

export { router };
