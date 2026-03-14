/** Examples page — annotated code examples */

const EXAMPLES = [
  {
    id: 'sorting-beads',
    icon: '🔴',
    title: 'Sorting Coloured Beads',
    difficulty: 'beginner',
    tags: ['Python', 'Classification'],
    desc: 'A classic starter project: train a model to recognise bead colours.',
    body: `
      <p>This example walks through a complete bead-sorting project from data
      collection through to live classification.</p>

      <h3>1. Collect data</h3>
      <p>Place each bead in front of the camera and capture ~40 images per colour.
      Use the JumpNet Python client:</p>
      <pre><code>from jumpnet import JumpNetClient
import cv2, base64

client = JumpNetClient("http://localhost:4080")
cap    = cv2.VideoCapture(0)

LABEL   = "red"       # change for each colour
DATASET = "beads"
COUNT   = 40

for _ in range(COUNT):
    ret, frame = cap.read()
    _, buf = cv2.imencode(".jpg", frame)
    b64 = base64.b64encode(buf).decode()
    client.dataset_upload(DATASET, LABEL, b64)
    cv2.waitKey(200)   # pause 200 ms between captures

cap.release()</code></pre>

      <h3>2. Train</h3>
      <p>Take your USB to the instructor's station and trigger training:</p>
      <pre><code>client.train("beads", epochs=25)</code></pre>

      <h3>3. Classify</h3>
      <p>Back at your station, classify a new image:</p>
      <pre><code>result = client.infer(open("test_bead.jpg", "rb").read())
print(result["output"], f'{result["confidenceScore"]:.0%}')</code></pre>

      <div class="callout tip">
        <strong>Tip:</strong> If red and orange are confused, collect more images
        of each and try again.
      </div>
    `,
  },
  {
    id: 'rock-paper',
    icon: '✊',
    title: 'Rock Paper Scissors',
    difficulty: 'beginner',
    tags: ['Python', 'Camera', 'Classification'],
    desc: 'Train a gesture classifier and play a live game against the model.',
    body: `
      <p>Capture hand gestures and build a three-class classifier: rock, paper, scissors.</p>

      <h3>Data collection tips</h3>
      <ul>
        <li>Use a plain, uncluttered background.</li>
        <li>Vary hand position and rotation slightly between captures.</li>
        <li>Capture 50–60 images per gesture for best results.</li>
      </ul>

      <h3>Live game loop (Node.js)</h3>
      <pre><code>import { JumpNetClient } from '/clients/node/index.js';
import { readFileSync }   from 'fs';

const client   = new JumpNetClient('http://localhost:4080');
const choices  = ['rock','paper','scissors'];

// Simulate a round: capture → classify → computer plays
async function round() {
  const buf    = readFileSync('/tmp/latest_frame.jpg');
  const result = await client.infer(buf);
  const player = result.output;
  const computer = choices[Math.floor(Math.random() * 3)];
  console.log(\`You: \${player}  |  Computer: \${computer}\`);
  // ... determine winner
}

setInterval(round, 2000);</code></pre>
    `,
  },
  {
    id: 'leaves',
    icon: '🍃',
    title: 'Plant Leaf Identification',
    difficulty: 'intermediate',
    tags: ['Python', 'Biology'],
    desc: 'Identify species or health status of plant leaves from photos.',
    body: `
      <p>Plants make excellent subjects for classification because leaves vary
      in shape, colour, and texture across species. This example builds a
      two-class classifier: healthy vs stressed (yellowing) tomato leaves.</p>

      <h3>Lighting matters</h3>
      <p>Leaves are partially transparent. Backlit and frontlit images look very
      different. Collect images consistently — ideally with diffuse natural light.</p>

      <h3>Augmentation advice</h3>
      <p>When your dataset is small, capture each leaf from multiple angles and
      distances. The training pipeline applies random flips automatically.</p>

      <pre><code># Upload a batch of leaf images at once
import glob, base64
from jumpnet import JumpNetClient

client = JumpNetClient("http://localhost:4080")

for path in glob.glob("healthy_leaves/*.jpg"):
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    client.dataset_upload("tomato", "healthy", b64)

for path in glob.glob("stressed_leaves/*.jpg"):
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    client.dataset_upload("tomato", "stressed", b64)</code></pre>
    `,
  },
  {
    id: 'micropython-classify',
    icon: '🔌',
    title: 'MicroPython Live Classifier',
    difficulty: 'intermediate',
    tags: ['MicroPython', 'ESP32', 'Hardware'],
    desc: 'Run classification from an ESP32-S3 with a built-in camera.',
    body: `
      <p>The MicroPython client lets an ESP32-S3 (e.g. XIAO ESP32S3 Sense) capture
      a frame, send it to JumpNet over Wi-Fi, and receive the prediction — all in
      a few lines of code.</p>

      <pre><code>from jumpnet import JumpNetClient
import camera

client = JumpNetClient("http://192.168.1.100:4080")

camera.init(format=camera.JPEG, quality=10)

while True:
    frame  = camera.capture()
    result = client.infer(frame)
    print(result["output"], result["confidenceScore"])
    time.sleep(0.5)</code></pre>

      <p>The <code>cep.py</code> module on the USB drive also lets your device
      register itself with the JumpNet server, making it discoverable via
      <code>GET /devices</code>.</p>

      <div class="callout">
        See the <code>clients/micropython/</code> folder on your USB drive for
        the full client source and driver library.
      </div>
    `,
  },
  {
    id: 'curl-quickstart',
    icon: '⚡',
    title: 'curl Quick-start',
    difficulty: 'beginner',
    tags: ['curl', 'REST API'],
    desc: 'Interact with every JumpNet endpoint from the terminal.',
    body: `
      <h3>Check server</h3>
      <pre><code>curl http://localhost:4080/status</code></pre>

      <h3>Upload an image</h3>
      <pre><code>curl -X POST http://localhost:4080/dataset/upload \\
  -F file=@bead.jpg \\
  -F dataset=beads \\
  -F label=red</code></pre>

      <h3>Classify</h3>
      <pre><code>curl -X POST http://localhost:4080/infer \\
  -F image=@bead.jpg</code></pre>

      <h3>List datasets</h3>
      <pre><code>curl http://localhost:4080/dataset/list</code></pre>

      <h3>Trigger training</h3>
      <pre><code>curl -X POST http://localhost:4080/train \\
  -H "Content-Type: application/json" \\
  -d '{"datasetId":"beads","epochs":20}'</code></pre>
    `,
  },
];

export function renderExamples(el, _subId, navigate) {
  el.innerHTML = `
    <h1>💡 Examples</h1>
    <p class="page-subtitle">Annotated code examples for common JumpNet tasks.</p>
    <div class="card-grid" id="examples-grid"></div>
  `;

  const grid = el.querySelector('#examples-grid');
  EXAMPLES.forEach(ex => {
    const card = document.createElement('a');
    card.className = 'card-link';
    card.href = '#';
    card.innerHTML = `
      <span class="card-icon">${ex.icon}</span>
      <div class="card-title">${ex.title}</div>
      <div class="card-desc">${ex.desc}</div>
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
        ${ex.tags.map(t => `<span class="card-badge badge-example">${t}</span>`).join('')}
      </div>
    `;
    card.addEventListener('click', e => { e.preventDefault(); navigate('examples', ex.id); });
    grid.appendChild(card);
  });
}

export function renderExample(el, id, navigate) {
  const ex = EXAMPLES.find(e => e.id === id);
  if (!ex) { el.innerHTML = '<p>Example not found.</p>'; return; }

  el.innerHTML = `
    <a class="back-link" id="back">← Back to Examples</a>
    <div class="article">
      <h1>${ex.icon} ${ex.title}</h1>
      <div class="meta">
        <span class="diff-${ex.difficulty}">${ex.difficulty}</span>
        ${ex.tags.map(t => `<span class="card-badge badge-example">${t}</span>`).join('')}
      </div>
      ${ex.body}
    </div>
  `;
  el.querySelector('#back').addEventListener('click', e => {
    e.preventDefault(); navigate('examples');
  });
}
