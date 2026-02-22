/**
 * server/localDatastore.js
 *
 * Manages local dataset storage under DATA_DIR/datasets/<dataset>/<label>/<file>.
 * No upstream dependency — works standalone.
 */
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID }    from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = process.env.DATA_DIR
  ?? fileURLToPath(new URL('../data', import.meta.url));

const DATASETS_ROOT = join(DATA_DIR, 'datasets');
const ALLOWED_EXT   = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);

function isImage(name) {
  return ALLOWED_EXT.has(extname(name).toLowerCase());
}

/** Ensure directory exists (mkdir -p). */
async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save an image buffer to DATA_DIR/datasets/<dataset>/<label>/<unique>.ext
 * Accepts either a Buffer (file upload) or a base64 string.
 *
 * @returns {{ saved: string, dataset: string, label: string, filename: string }}
 */
export async function saveImage({ dataset, label, imageBuffer, base64, originalName }) {
  // Sanitize path components — no slashes or dots allowed
  const safeDataset = dataset.replace(/[^\w\-]/g, '_');
  const safeLabel   = label.replace(/[^\w\-]/g, '_');

  const ext = originalName ? extname(originalName).toLowerCase() || '.jpg' : '.jpg';
  const filename = `${Date.now()}_${randomUUID().slice(0, 8)}${ext}`;

  const dir = join(DATASETS_ROOT, safeDataset, safeLabel);
  await ensureDir(dir);

  const buf = imageBuffer ?? Buffer.from(base64, 'base64');
  const fullPath = join(dir, filename);
  await writeFile(fullPath, buf);

  // Return a relative path for portability
  const saved = `datasets/${safeDataset}/${safeLabel}/${filename}`;
  return { saved, dataset: safeDataset, label: safeLabel, filename };
}

/**
 * List all datasets with summary counts.
 * @returns {Array<{ name, labelCount, imageCount, sizeBytes }>}
 */
export async function listDatasets() {
  await ensureDir(DATASETS_ROOT);
  const entries = await readdir(DATASETS_ROOT, { withFileTypes: true });
  const datasets = entries.filter(e => e.isDirectory());

  return Promise.all(datasets.map(async (d) => {
    const dsPath = join(DATASETS_ROOT, d.name);
    const labelDirs = (await readdir(dsPath, { withFileTypes: true })).filter(e => e.isDirectory());
    let imageCount = 0;
    let sizeBytes  = 0;
    for (const lbl of labelDirs) {
      const lblPath = join(dsPath, lbl.name);
      const files   = (await readdir(lblPath)).filter(isImage);
      imageCount += files.length;
      for (const f of files) {
        const s = await stat(join(lblPath, f)).catch(() => null);
        if (s) sizeBytes += s.size;
      }
    }
    return { name: d.name, labelCount: labelDirs.length, imageCount, sizeBytes };
  }));
}

/**
 * Get details for one dataset: labels → [filenames].
 * @returns {{ name, labels: Record<string, string[]> } | null}
 */
export async function getDataset(name) {
  const dsPath = join(DATASETS_ROOT, name);
  if (!existsSync(dsPath)) return null;

  const labelDirs = (await readdir(dsPath, { withFileTypes: true })).filter(e => e.isDirectory());
  const labels = {};
  for (const lbl of labelDirs) {
    labels[lbl.name] = (await readdir(join(dsPath, lbl.name))).filter(isImage);
  }
  return { name, labels };
}

/**
 * Delete a single image file.
 * @returns {boolean} true if deleted, false if not found
 */
export async function deleteImage(dataset, label, filename) {
  const filePath = join(DATASETS_ROOT, dataset, label, filename);
  if (!existsSync(filePath)) return false;
  await rm(filePath);
  return true;
}

/**
 * Get the full path for a stored image (for streaming).
 * @returns {string | null}
 */
export function getImagePath(dataset, label, filename) {
  const filePath = join(DATASETS_ROOT, dataset, label, filename);
  return existsSync(filePath) ? filePath : null;
}

export { createReadStream };
