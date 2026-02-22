/**
 * GET /status
 *
 * Returns JumpNet server health plus upstream JumpSmartsRuntime health.
 *
 * Response:
 * {
 *   "jumpnet":   { "status": "ok", "uptime": 123.4 },
 *   "upstream":  { "status": "ok" | "unreachable", "url": "http://..." },
 *   "timestamp": "2026-02-21T12:00:00.000Z"
 * }
 */
import { Router } from 'express';
import { UPSTREAM } from '../server.js';

export const router = Router();

const startedAt = Date.now();

router.get('/', async (_req, res) => {
  let upstreamStatus = 'unreachable';
  try {
    const r = await fetch(`${UPSTREAM}/bundles`, { signal: AbortSignal.timeout(3000) });
    if (r.ok || r.status < 500) upstreamStatus = 'ok';
  } catch { /* unreachable */ }

  res.json({
    jumpnet:   { status: 'ok', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) },
    upstream:  { status: upstreamStatus, url: UPSTREAM },
    timestamp: new Date().toISOString(),
  });
});
