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
import { scanJumpapps } from '../localDatastore.js';

export const router = Router();

const startedAt = Date.now();

router.get('/', async (_req, res) => {
  let upstreamStatus = 'unreachable';
  let trainAvailable = null;
  try {
    const r = await fetch(`${UPSTREAM}/status`, { signal: AbortSignal.timeout(3000) });
    if (r.ok || r.status < 500) {
      upstreamStatus = 'ok';
      const data = await r.json().catch(() => ({}));
      trainAvailable = data.trainAvailable ?? null;
    }
  } catch { /* unreachable */ }

  const jumpapps = await scanJumpapps().catch(() => []);

  res.json({
    jumpnet:        { status: 'ok', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) },
    upstream:       { status: upstreamStatus, url: UPSTREAM },
    trainAvailable: trainAvailable,
    storage:        { jumpapps },
    timestamp:      new Date().toISOString(),
  });
});
