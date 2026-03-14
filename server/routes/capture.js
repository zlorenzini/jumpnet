/**
 * server/routes/capture.js
 *
 * POST /capture
 *
 * Captures a single frame from the local camera via ffmpeg, then immediately
 * runs inference against JumpSmartsRuntime (port 7312).
 *
 * Optional body (JSON):
 *   bundleId   string   model bundle to use (default: "current")
 *   device     string   v4l2 device         (default: "/dev/video0")
 *   resolution string   WxH                 (default: "960x720")
 *   fps        number   framerate hint       (default: 10)
 *   warmup     number   frames to discard for AE/AWB settle (default: 3)
 */

import { Router }  from 'express';
import { exec }    from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream } from 'node:fs';
import { UPSTREAM } from '../server.js';

const execAsync = promisify(exec);
const router    = Router();

const DEFAULTS = {
  device:      '/dev/video0',
  resolution:  '960x720',
  fps:         10,
  warmup:      3,    // frames captured before the keeper — lets AE/AWB settle
  capturePath: '/tmp/jumpnet_capture.jpg',
};

router.post('/', async (req, res, next) => {
  try {
    const bundleId   = req.body?.bundleId   ?? 'current';
    const device     = req.body?.device     ?? DEFAULTS.device;
    const resolution = req.body?.resolution ?? DEFAULTS.resolution;
    const fps        = req.body?.fps        ?? DEFAULTS.fps;
    const warmup     = Math.max(1, parseInt(req.body?.warmup ?? DEFAULTS.warmup));
    const capturePath = DEFAULTS.capturePath;

    // ── Capture frame ─────────────────────────────────────────────────────────
    // Capture (warmup + 1) frames with -update 1 so ffmpeg overwrites the
    // same file on every frame.  The camera's AE/AWB settles over the warmup
    // frames; the final write is the correctly-exposed keeper.
    const cmd = [
      'ffmpeg',
      '-f v4l2',
      '-input_format yuyv422',
      `-video_size ${resolution}`,
      `-framerate ${fps}`,
      `-i ${device}`,
      `-frames:v ${warmup + 1}`,
      '-update 1',
      `-y ${capturePath}`,
      '-loglevel error',
    ].join(' ');

    const start = Date.now();
    await execAsync(cmd);
    const latency = Date.now() - start;

    // ── Forward to JumpSmartsRuntime via multipart ────────────────────────────
    const { FormData, File } = await import('node:buffer').then(() =>
      // Node 18+ has FormData globally; fall back gracefully
      ({ FormData: globalThis.FormData, File: globalThis.File })
    );

    // Build multipart with the captured file stream
    // Node's native fetch doesn't support ReadStream in FormData — read the
    // file into a Buffer first (capture is small, typically 20–100 KB).
    const { readFile } = await import('node:fs/promises');
    const imageBuffer  = await readFile(capturePath);
    const blob         = new Blob([imageBuffer], { type: 'image/jpeg' });

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
