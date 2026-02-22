// examples/node/infer.js — run image classification via JumpNet.
// Usage:  node infer.js <image_path> [bundle_id]

import { readFileSync } from 'node:fs';

const JUMPNET = process.env.JUMPNET_URL ?? 'http://localhost:4080';

async function infer(imagePath, bundleId) {
  const image = readFileSync(imagePath).toString('base64');
  const body  = JSON.stringify({ image, ...(bundleId ? { bundleId } : {}) });

  const res  = await fetch(`${JUMPNET}/infer`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

const [,, imagePath, bundleId] = process.argv;
if (!imagePath) { console.error('Usage: node infer.js <image_path> [bundle_id]'); process.exit(1); }

infer(imagePath, bundleId)
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(e => { console.error(e.message); process.exit(1); });
