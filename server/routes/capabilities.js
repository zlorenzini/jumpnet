/**
 * GET /capabilities
 *
 * Describes this JumpNet node's identity, roles, models, sensors, compute,
 * and network. Lightweight — no inference or heavy work performed.
 *
 * Configurable via environment variables:
 *   DEVICE_ID      default "jumpnet"
 *   DEVICE_ROLES   comma-separated, default "jumpnet"
 *   DEVICE_SENSORS comma-separated, default ""
 *   PORT           default 4080
 */
import { Router }        from 'express';
import { networkInterfaces, cpus, freemem, uptime, hostname } from 'node:os';
import { PORT }          from '../server.js';

export const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the first non-loopback IPv4 address, or '127.0.0.1'. */
function localIp() {
  for (const iface of Object.values(networkInterfaces())) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '127.0.0.1';
}

/**
 * Samples CPU load over a short interval (100 ms).
 * Returns a float 0.0–1.0 averaged across all cores.
 */
function cpuLoad() {
  return new Promise(resolve => {
    const before = cpus().map(c => ({ idle: c.times.idle, total: Object.values(c.times).reduce((a, b) => a + b, 0) }));
    setTimeout(() => {
      const after = cpus().map(c => ({ idle: c.times.idle, total: Object.values(c.times).reduce((a, b) => a + b, 0) }));
      const loads = before.map((b, i) => {
        const dTotal = after[i].total - b.total;
        const dIdle  = after[i].idle  - b.idle;
        return dTotal === 0 ? 0 : (dTotal - dIdle) / dTotal;
      });
      const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
      resolve(Math.round(avg * 1000) / 1000);    // 3 decimal places
    }, 100);
  });
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.get('/', async (_req, res, next) => {
  try {
    const load = await cpuLoad();

    res.json({
      device:  process.env.DEVICE_ID ?? 'jumpnet',
      roles:   (process.env.DEVICE_ROLES ?? 'jumpnet').split(',').map(s => s.trim()).filter(Boolean),
      models:  [],   // populated once real inference bundles are loaded
      sensors: (process.env.DEVICE_SENSORS ?? '').split(',').map(s => s.trim()).filter(Boolean),
      compute: {
        cpuLoad:       load,
        gpu:           'none',
        memoryFreeMB:  Math.floor(freemem() / (1024 * 1024)),
        uptimeSeconds: Math.floor(uptime()),
      },
      network: {
        ip:       localIp(),
        port:     PORT,
        hostname: hostname(),
      },
    });
  } catch (err) { next(err); }
});
