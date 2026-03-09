/**
 * server/routes/train.js
 *
 * POST /train
 * Body: { datasetId: string, bundleId?: string, epochs?: number,
 *         imageSize?: number, batchSize?: number }
 *
 * Proxies to JumpSmartsRuntime (port 7312) which runs the actual
 * MobileNetV2 training asynchronously and returns a job object.
 *
 * Optional: if GPU_HELPER_URL is set and that node has a GPU, the
 * request is delegated there instead.
 */
import { Router }      from 'express';
import { UPSTREAM }    from '../server.js';
import { tryDelegate } from '../lib/delegate.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    // ── Optional delegation to a GPU helper node ──────────────────────────
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

export { router };
