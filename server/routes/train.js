/**
 * server/routes/train.js
 *
 * POST   /train                 start a training job
 * GET    /train                 list all jobs
 * GET    /train/:id             get job status + result
 * GET    /train/:id/logs        get log lines for a job
 * POST   /train/:id/stop        request graceful stop
 * POST   /train/:id/export      export best .pth → .onnx (CUDA-accelerated on 1660 Ti)
 *
 * Body (POST /train): { datasetId, bundleId?, epochs?, imageSize?, batchSize? }
 *
 * All requests proxy to JumpSmartsRuntime (port 7312).
 * If GPU_HELPER_URL is set the train-start request is delegated there.
 */
import { Router }      from 'express';
import { UPSTREAM }    from '../server.js';
import { tryDelegate } from '../lib/delegate.js';

const router = Router();

// ── POST /train  — start a new training job ───────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    if (process.env.GPU_HELPER_URL) {
      const delegated = await tryDelegate('/train', req.body);
      if (delegated !== null) return res.json(delegated);
    }

    const r = await fetch(`${UPSTREAM}/train`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(req.body ?? {}),
      signal:  AbortSignal.timeout(180_000),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /train  — list all jobs ───────────────────────────────────────────────
router.get('/', async (_req, res, next) => {
  try {
    const r = await fetch(`${UPSTREAM}/train`, { signal: AbortSignal.timeout(10_000) });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /train/:id  — job detail ──────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const r = await fetch(`${UPSTREAM}/train/${req.params.id}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /train/:id/logs  — log lines ─────────────────────────────────────────
router.get('/:id/logs', async (req, res, next) => {
  try {
    const r = await fetch(`${UPSTREAM}/train/${req.params.id}/logs`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    next(err);
  }
});

// ── POST /train/:id/stop  — request graceful stop ─────────────────────────────
router.post('/:id/stop', async (req, res, next) => {
  try {
    const r = await fetch(`${UPSTREAM}/train/${req.params.id}/stop`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    next(err);
  }
});

// ── POST /train/:id/export  — export .pth → .onnx ────────────────────────────
router.post('/:id/export', async (req, res, next) => {
  try {
    const r = await fetch(`${UPSTREAM}/train/${req.params.id}/export`, {
      method: 'POST',
      signal: AbortSignal.timeout(120_000),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    next(err);
  }
});

export { router };
