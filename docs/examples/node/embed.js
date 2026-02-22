// examples/node/embed.js — get a text embedding via JumpNet.
// Usage:  node embed.js "your text here"

const JUMPNET = process.env.JUMPNET_URL ?? 'http://localhost:4080';

async function embed(text, dimensions = 128) {
  const res = await fetch(`${JUMPNET}/embed`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text, dimensions }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const text = process.argv.slice(2).join(' ') || 'round red bead';
embed(text)
  .then(r => {
    console.log(`Model:      ${r.model}`);
    console.log(`Dimensions: ${r.dimensions}`);
    console.log(`First 8:    ${r.embedding.slice(0, 8).join(', ')}`);
  })
  .catch(e => { console.error(e.message); process.exit(1); });
