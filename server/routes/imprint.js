/**
 * /imprint — lightweight fine-tuning (wraps JumpSmartsRuntime /train).
 *
 *   POST /imprint            — start a new imprint (training) job
 *   GET  /imprint            — list all jobs
 *   GET  /imprint/:id        — job status
 *   GET  /imprint/:id/logs   — job logs
 *   POST /imprint/:id/stop   — stop a job
 */
import { Router } from 'express';
import { UPSTREAM } from '../server.js';

export const router = Router();

const proxy = async (upPath, method = 'GET', body = null) => {
  const opts = { method, headers: {} };
  if (body) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(`${UPSTREAM}${upPath}`, opts);
  return { status: r.status, data: await r.json() };
};

router.post('/', async (req, res, next) => {
  try {
    const { dataset, epochs = 10, learningRate = 0.001 } = req.body ?? {};
    if (!dataset) return res.status(400).json({ error: '"dataset" is required.' });
    const { status, data } = await proxy('/train', 'POST', { dataset, epochs, learningRate });
    res.status(status).json(data);
  } catch (err) { next(err); }
});

router.get('/', async (_req, res, next) => {
  try {
    const { status, data } = await proxy('/train');
    res.status(status).json(data);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { status, data } = await proxy(`/train/${req.params.id}`);
    res.status(status).json(data);
  } catch (err) { next(err); }
});

router.get('/:id/logs', async (req, res, next) => {
  try {
    const { status, data } = await proxy(`/train/${req.params.id}/logs`);
    res.status(status).json(data);
  } catch (err) { next(err); }
});

router.post('/:id/stop', async (req, res, next) => {
  try {
    const { status, data } = await proxy(`/train/${req.params.id}/stop`, 'POST');
    res.status(status).json(data);
  } catch (err) { next(err); }
});
