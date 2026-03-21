/**
 * server/routes/compile.js
 *
 * GET  /compile        – check dxcom availability and host architecture
 * POST /compile        – convert models/current/model.onnx → .dxnn (DEEPX NPU format)
 *
 * Body (POST /compile):
 *   {
 *     modelDir?:               path to dir with model.onnx + metadata.json (default: models/current)
 *     calibrationDataset?:     path to folder of calibration images (default: auto-detect from data/datasets)
 *     calibrationNum?:         calibration samples (default: 100, max: 1000)
 *     optLevel?:               0 (fast) or 1 (full, default)
 *     aggressivePartitioning?: boolean (default: false)
 *     genLog?:                 save compiler.log to output dir (default: false)
 *   }
 *
 * x86_64 only — returns 501 if the host CPU architecture is not x64.
 * Requires dxcom installed from https://github.com/DEEPX-AI/dx-compiler
 */
import { Router }         from 'express';
import { spawn }          from 'node:child_process';
import { execFileSync }   from 'node:child_process';
import {
  existsSync, mkdirSync, writeFileSync,
  readFileSync, readdirSync, statSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath }         from 'node:url';
import { arch }                  from 'node:os';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = resolve(join(__dirname, '..', '..', 'models'));
const DATA_DIR   = resolve(join(__dirname, '..', '..', 'data', 'datasets'));

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find the dxcom binary: PATH first, then common venv install locations. */
function findDxcom () {
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

/** Return first dataset directory found under DATA_DIR, or null. */
function autoCalibrationDataset () {
  if (!existsSync(DATA_DIR)) return null;
  const entry = readdirSync(DATA_DIR).find(name => {
    return statSync(join(DATA_DIR, name)).isDirectory();
  });
  return entry ? join(DATA_DIR, entry) : null;
}

// ── GET /compile — status ─────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  const hostArch  = arch();
  const dxcomPath = findDxcom();
  res.json({
    supported:  hostArch === 'x64',
    arch:       hostArch,
    dxcomFound: dxcomPath !== null,
    dxcomPath:  dxcomPath,
    installDocs: 'https://github.com/DEEPX-AI/dx-compiler',
  });
});

// ── POST /compile — convert ONNX → DNNX ──────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    // ── architecture guard ────────────────────────────────────────────────────
    const hostArch = arch();
    if (hostArch !== 'x64') {
      return res.status(501).json({
        error: `DNNX compilation requires an x86_64 host; this host reports arch="${hostArch}".`,
      });
    }

    // ── locate dxcom ──────────────────────────────────────────────────────────
    const dxcomBin = findDxcom();
    if (!dxcomBin) {
      return res.status(503).json({
        error: 'dxcom binary not found. Install the DEEPX compiler from https://github.com/DEEPX-AI/dx-compiler by running: ./install.sh --username=EMAIL --password=PASSWORD',
      });
    }

    // ── resolve model directory ───────────────────────────────────────────────
    const modelDir = req.body?.modelDir
      ? resolve(String(req.body.modelDir))
      : join(MODELS_DIR, 'current');

    const onnxPath = join(modelDir, 'model.onnx');
    const metaPath = join(modelDir, 'metadata.json');

    if (!existsSync(onnxPath)) {
      return res.status(404).json({ error: `model.onnx not found at: ${onnxPath}` });
    }
    if (!existsSync(metaPath)) {
      return res.status(404).json({ error: `metadata.json not found at: ${metaPath}` });
    }

    const meta      = JSON.parse(readFileSync(metaPath, 'utf8'));
    const imageSize = meta.imageSize ?? 224;

    // ── calibration dataset ───────────────────────────────────────────────────
    const calibPath = req.body?.calibrationDataset
      ? resolve(String(req.body.calibrationDataset))
      : autoCalibrationDataset();

    if (!calibPath || !existsSync(calibPath)) {
      return res.status(400).json({
        error: 'No calibration dataset found. Either capture images via POST /capture first, or supply calibrationDataset in the request body pointing to a folder of images.',
      });
    }

    // ── build dxcom config JSON ───────────────────────────────────────────────
    const calibrationNum = Math.min(Number(req.body?.calibrationNum ?? 100), 1000);

    const config = {
      inputs: {
        image: [1, 3, imageSize, imageSize],
      },
      calibration_method: 'ema',
      calibration_num: calibrationNum,
      default_loader: {
        dataset_path: calibPath,
        file_extensions: ['jpeg', 'jpg', 'png', 'JPEG', 'JPG', 'PNG'],
        preprocessings: [
          { resize: { width: imageSize, height: imageSize } },
          { normalize: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] } },
        ],
      },
    };

    // ── prepare output directory and config file ──────────────────────────────
    const outputDir  = join(modelDir, 'dnnx');
    mkdirSync(outputDir, { recursive: true });
    const configPath = join(outputDir, 'dxcom_config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

    // ── build CLI args ────────────────────────────────────────────────────────
    const optLevel               = Number(req.body?.optLevel ?? 1);
    const aggressivePartitioning = Boolean(req.body?.aggressivePartitioning);
    const genLog                 = Boolean(req.body?.genLog);

    const args = ['-m', onnxPath, '-c', configPath, '-o', outputDir + '/'];
    if (optLevel === 0)           args.push('--opt_level', '0');
    if (aggressivePartitioning)   args.push('--aggressive_partitioning');
    if (genLog)                   args.push('--gen_log');

    // ── run dxcom ─────────────────────────────────────────────────────────────
    const startMs  = Date.now();
    const stdoutBuf = [];
    const stderrBuf = [];

    await new Promise((resolveP, rejectP) => {
      const proc = spawn(dxcomBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.stdout.on('data', chunk => stdoutBuf.push(chunk.toString()));
      proc.stderr.on('data', chunk => stderrBuf.push(chunk.toString()));
      proc.on('close', code => {
        if (code === 0) return resolveP();
        const msg = stderrBuf.join('') || stdoutBuf.join('');
        rejectP(Object.assign(new Error(`dxcom exited with code ${code}: ${msg}`), { code }));
      });
      proc.on('error', err => rejectP(new Error(`Failed to start dxcom: ${err.message}`)));
    });

    const elapsedMs = Date.now() - startMs;

    // ── locate output file (.dxnn or .dnnx — docs use both spellings) ─────────
    const candidates = ['model.dxnn', 'model.dnnx'];
    const dnnxFile   = candidates.map(f => join(outputDir, f)).find(f => existsSync(f)) ?? null;
    const sizeBytes  = dnnxFile ? statSync(dnnxFile).size : null;

    res.json({
      ok:        true,
      dnnxPath:  dnnxFile,
      outputDir,
      sizeBytes,
      elapsedMs,
      log:       stdoutBuf.join(''),
    });
  } catch (err) {
    next(err);
  }
});

export { router };
