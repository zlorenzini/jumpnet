/**
 * server/routes/train.js
 *
 * POST /train
 * Body: { datasetId: string, epochs?: number, imageSize?: number, batchSize?: number }
 *
 * Resolves the dataset directory from localDatastore, then spawns
 * server/ml/train.py via mlRunner.  Returns the final result JSON.
 *
 * Optional: if GPU_HELPER_URL is set and that node has a GPU, the request
 * is delegated there instead.
 */
import { Router }         from 'express';
import { fileURLToPath }  from 'node:url';
import { join }           from 'node:path';
import { existsSync }     from 'node:fs';
import { getDataset }     from '../localDatastore.js';
import { runTrain }       from '../mlRunner.js';
import { tryDelegate }    from '../lib/delegate.js';

const router   = Router();
const DATA_DIR = fileURLToPath(new URL('../../data', import.meta.url));
const MODELS_DIR = fileURLToPath(new URL('../../models', import.meta.url));

router.post('/', async (req, res, next) => {
  try {
    // ── Optional delegation to a GPU helper node ──────────────────────────
    if (process.env.GPU_HELPER_URL) {
      const delegated = await tryDelegate('/train', req.body);
      if (delegated !== null) return res.json(delegated);
    }

    const { datasetId, epochs = 5, imageSize = 224, batchSize = 16 } = req.body ?? {};

    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required' });
    }

    // Resolve the dataset root (the dir that has sub-folders per label)
    const datasetPath = join(DATA_DIR, 'datasets', datasetId);
    if (!existsSync(datasetPath)) {
      return res.status(404).json({ error: `Dataset '${datasetId}' not found` });
    }

    const modelDir = join(MODELS_DIR, 'current');

    // Collect progress lines to include in response (useful for small UIs)
    const progressLines = [];

    const result = await runTrain(
      { datasetPath, modelDir, epochs, imageSize, batchSize },
      line => progressLines.push(line),
    );

    res.json({ ...result, progress: progressLines });
  } catch (err) {
    next(err);
  }
});

export { router };
