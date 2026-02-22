/**
 * server/mlRunner.js
 *
 * Spawns Python ML subprocesses (train.py / infer.py) and communicates
 * via stdin/stdout JSON. Streams progress lines back as they arrive.
 *
 * Usage:
 *   const { runTrain, runInfer } = await import('./mlRunner.js');
 */
import { spawn }      from 'node:child_process';
import { join }       from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface }  from 'node:readline';

const ML_DIR     = fileURLToPath(new URL('./ml', import.meta.url));

/**
 * Resolve the Python executable.
 * Checks: PYTHON_BIN env > python3 > python
 */
export const PYTHON = process.env.PYTHON_BIN ?? 'python3';

/**
 * Run a Python script with JSON piped to stdin.
 * Yields progress lines (parsed JSON), resolves with final result line.
 *
 * @param {string}   scriptName  e.g. 'train.py'
 * @param {object}   input       JSON-serialisable config
 * @param {Function} [onProgress] callback(parsedLine) for intermediate progress
 * @returns {Promise<object>}    final { status, ... } line
 */
export function runPython(scriptName, input, onProgress) {
  return new Promise((resolve, reject) => {
    const scriptPath = join(ML_DIR, scriptName);
    const child      = spawn(PYTHON, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();

    const rl = createInterface({ input: child.stdout });
    const results = [];

    rl.on('line', line => {
      if (!line.trim()) return;
      let parsed;
      try { parsed = JSON.parse(line); } catch { return; }    // ignore non-JSON stdout noise

      if (parsed.status === 'progress') {
        onProgress?.(parsed);
      } else {
        results.push(parsed);
      }
    });

    const stderr = [];
    child.stderr.on('data', d => stderr.push(d.toString()));

    child.on('close', code => {
      const last = results.at(-1);
      if (last?.status === 'ok') {
        resolve(last);
      } else if (last?.status === 'error') {
        reject(new Error(last.message ?? 'ML script error'));
      } else if (code !== 0) {
        reject(new Error(stderr.join('') || `Python exited with code ${code}`));
      } else {
        reject(new Error('ML script produced no result'));
      }
    });

    child.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(`Python not found (tried: "${PYTHON}"). Set PYTHON_BIN env var.`));
      } else {
        reject(err);
      }
    });
  });
}

export const runTrain = (input, onProgress) => runPython('train.py', input, onProgress);
export const runInfer = (input, onProgress) => runPython('infer.py', input, onProgress);
