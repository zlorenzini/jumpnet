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
import { networkInterfaces, cpus, freemem, uptime, hostname, arch } from 'node:os';
import { execFile, execFileSync } from 'node:child_process';
import { promisify }     from 'node:util';
import { existsSync }    from 'node:fs';
import { join }          from 'node:path';
import { PORT }          from '../server.js';

export const router = Router();
const execFileAsync = promisify(execFile);

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
      resolve(Math.round(avg * 1000) / 1000);
    }, 100);
  });
}

/**
 * Probe NVIDIA GPU via nvidia-smi.
 * Returns { available: bool, name: string|null, memoryFreeMB: int|null, utilization: float|null }
 */
async function probeGpu() {
  // Allow explicit override
  const override = process.env.GPU_OVERRIDE;
  if (override === 'none') return { available: false, name: null, memoryFreeMB: null, utilization: null };
  if (override === 'available') return { available: true, name: 'override', memoryFreeMB: null, utilization: null };

  try {
    // Query: name, memory.free (MiB), utilization.gpu (%)
    const { stdout } = await execFileAsync('nvidia-smi', [
      '--query-gpu=name,memory.free,utilization.gpu',
      '--format=csv,noheader,nounits',
    ], { timeout: 3000 });

    const [name, memFree, util] = stdout.trim().split(',').map(s => s.trim());
    return {
      available:     true,
      name:          name  || null,
      memoryFreeMB:  memFree ? parseInt(memFree) : null,
      utilization:   util    ? Math.round(parseFloat(util)) / 100 : null,
    };
  } catch {
    return { available: false, name: null, memoryFreeMB: null, utilization: null };
  }
}

// ── dxcom detection (same logic as compile.js) ──────────────────────────────

function findDxcom() {
  try {
    const p = execFileSync('which', ['dxcom'], { encoding: 'utf8' }).trim();
    if (p) return p;
  } catch { /* not in PATH */ }
  const candidates = [
    join(process.env.HOME || '/root', 'dx-compiler', 'venv-dx-compiler-local', 'bin', 'dxcom'),
    join(process.env.HOME || '/root', '.local', 'share', 'dx-compiler', 'venv-dx-compiler-local', 'bin', 'dxcom'),
    '/jump/dx-compiler/venv-dx-compiler-local/bin/dxcom',
    '/opt/dx-compiler/venv-dx-compiler-local/bin/dxcom',
    '/usr/local/bin/dxcom',
  ];
  return candidates.find(c => existsSync(c)) ?? null;
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.get('/', async (_req, res, next) => {
  try {
    const [load, gpu] = await Promise.all([cpuLoad(), probeGpu()]);

    // Build services list — advertise dx_compile if dxcom is installed and host is x86_64
    const services = ['infer', 'train'];
    if (arch() === 'x64' && findDxcom() !== null) services.push('dx_compile');

    res.json({
      device:  process.env.DEVICE_ID ?? 'jumpnet',
      roles:   (process.env.DEVICE_ROLES ?? 'jumpnet').split(',').map(s => s.trim()).filter(Boolean),
      models:  [],   // populated once real inference bundles are loaded
      sensors: (process.env.DEVICE_SENSORS ?? '').split(',').map(s => s.trim()).filter(Boolean),
      compute: {
        cpuLoad:       load,
        gpu:           gpu.available ? 'available' : 'none',
        gpuName:       gpu.name          ?? undefined,
        gpuMemFreeMB:  gpu.memoryFreeMB  ?? undefined,
        gpuUtil:       gpu.utilization   ?? undefined,
        memoryFreeMB:  Math.floor(freemem() / (1024 * 1024)),
        uptimeSeconds: Math.floor(uptime()),
        services,
      },
      network: {
        ip:       localIp(),
        port:     PORT,
        hostname: hostname(),
      },
    });
  } catch (err) { next(err); }
});
