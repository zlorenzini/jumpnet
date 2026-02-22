import express      from 'express';
import { router as inferRouter        } from './routes/infer.js';
import { router as embedRouter        } from './routes/embed.js';
import { router as datasetRouter      } from './routes/dataset.js';
import { router as composeRouter      } from './routes/compose.js';
import { router as imprintRouter      } from './routes/imprint.js';
import { router as statusRouter       } from './routes/status.js';
import { router as capabilitiesRouter } from './routes/capabilities.js';

// ── Config ────────────────────────────────────────────────────────────────────
export const UPSTREAM = process.env.JUMPSMARTS_URL ?? 'http://localhost:7312';
export const PORT     = parseInt(process.env.PORT  ?? '4080');

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '50mb' }));

// Request logger (dev-friendly)
app.use((req, _res, next) => {
  process.stdout.write(`[jumpnet] ${req.method} ${req.url}\n`);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/infer',        inferRouter);
app.use('/embed',        embedRouter);
app.use('/dataset',      datasetRouter);
app.use('/compose',      composeRouter);
app.use('/imprint',      imprintRouter);
app.use('/status',       statusRouter);
app.use('/capabilities', capabilitiesRouter);

// 404 catch-all
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`JumpNet server listening on http://localhost:${PORT}`);
  console.log(`Upstream JumpSmarts: ${UPSTREAM}`);
});
