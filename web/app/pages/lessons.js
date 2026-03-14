/** Lessons page + individual lesson renderer */

const LESSONS = [
  {
    id: 'what-is-ml',
    icon: '🧠',
    title: 'What is Machine Learning?',
    difficulty: 'beginner',
    duration: '10 min',
    desc: 'A gentle introduction to how computers learn from data.',
    body: `
      <p>Machine learning (ML) is a way of programming computers that is fundamentally
      different from writing rules by hand. Instead of telling the computer exactly
      what to do in every situation, you show it many <strong>examples</strong> and let
      it figure out the patterns on its own.</p>

      <div class="callout tip">
        <strong>Analogy:</strong> Think about how you learned to recognise a dog.
        Nobody gave you a rulebook — you just saw lots of dogs (and non-dogs) until
        your brain built a mental model.
      </div>

      <h3>Supervised Learning</h3>
      <p>Most image classification tasks use <em>supervised learning</em>: we provide
      labelled examples — images paired with the correct answer — and the algorithm
      adjusts its internal weights until it can predict the label from the image alone.</p>

      <h3>The Three Phases</h3>
      <ol>
        <li><strong>Data collection</strong> — gather labelled images for each class.</li>
        <li><strong>Training</strong> — the model sees each image, makes a prediction, and
            adjusts when it's wrong. Repeated many times (epochs).</li>
        <li><strong>Inference</strong> — use the trained model to classify new, unseen images.</li>
      </ol>

      <h3>What JumpNet Does</h3>
      <p>JumpNet wraps a compact neural network (MobileNetV2) that runs efficiently
      even on low-power hardware. You collect data with a camera, the instructor trains
      the model on a fast machine, and the resulting model bundle is placed back on your
      USB drive so you can classify in real time.</p>

      <div class="callout">
        <strong>Next up:</strong> Read <em>Image Classification</em> to understand how
        the network actually sees an image.
      </div>
    `,
  },
  {
    id: 'image-class',
    icon: '🖼️',
    title: 'Image Classification',
    difficulty: 'beginner',
    duration: '15 min',
    desc: 'How models learn to tell objects apart using pixels.',
    body: `
      <p>An image is just a grid of numbers — each pixel has a red, green, and blue value
      between 0 and 255. A classification model takes those numbers as input and outputs
      a probability for each possible label.</p>

      <h3>Convolutional Neural Networks (CNNs)</h3>
      <p>Modern image classifiers use CNNs. Early layers learn to detect edges and
      textures; deeper layers combine those into shapes; the final layers recognise
      whole objects.</p>

      <h3>MobileNetV2</h3>
      <p>JumpNet uses MobileNetV2, a lightweight CNN designed to run on mobile and
      embedded hardware. It achieves high accuracy with a fraction of the computation
      of larger models.</p>

      <h3>Transfer Learning</h3>
      <p>Training a CNN from scratch needs millions of images. Transfer learning starts
      from a model already trained on a large dataset (ImageNet) and <em>fine-tunes</em>
      the final layers on your small dataset. This is what the <code>/train</code>
      endpoint does.</p>

      <pre><code>Your images → pre-trained backbone → new classification head → your labels</code></pre>

      <div class="callout tip">
        <strong>Rule of thumb:</strong> Aim for at least 20–50 images per class for
        a reasonable result, and try to capture them under varied lighting and angles.
      </div>
    `,
  },
  {
    id: 'training-workflow',
    icon: '🔄',
    title: 'The Training Workflow',
    difficulty: 'beginner',
    duration: '12 min',
    desc: 'Step-by-step: collect data, train, evaluate, and deploy.',
    body: `
      <p>Every JumpNet project follows the same four-step cycle:</p>

      <h3>1 — Collect Data</h3>
      <p>Point a camera at each object you want to classify and capture images.
      Aim for diversity: different distances, angles, backgrounds, and lighting.
      Store images under a dataset name with one label per class.</p>

      <pre><code>POST /dataset/upload
{ "dataset": "beads", "label": "red", "image": "&lt;base64&gt;" }</code></pre>

      <h3>2 — Train</h3>
      <p>Bring your USB drive to the instructor's station. The training script
      fine-tunes MobileNetV2 on your dataset and writes a model bundle back to
      the drive.</p>

      <pre><code>POST /train
{ "datasetId": "beads", "epochs": 20 }</code></pre>

      <h3>3 — Evaluate</h3>
      <p>After training, check the accuracy and loss metrics in the model metadata.
      If accuracy is low, collect more images or add more epochs.</p>

      <h3>4 — Classify</h3>
      <p>Return to your station and use the Classify tool (or a microcontroller)
      to test the model on live images.</p>

      <pre><code>POST /infer
{ "image": "&lt;base64&gt;" }</code></pre>

      <div class="callout warn">
        <strong>Common mistake:</strong> Only capturing images in one lighting condition.
        Always test under different lights before declaring success.
      </div>
    `,
  },
  {
    id: 'datasets-labels',
    icon: '🏷️',
    title: 'Datasets and Labels',
    difficulty: 'beginner',
    duration: '8 min',
    desc: 'Why good labelling is the foundation of a good model.',
    body: `
      <p>The quality of your model is bounded by the quality of your data.
      Garbage in, garbage out — as the saying goes.</p>

      <h3>Choosing Labels</h3>
      <p>Labels should be <em>mutually exclusive</em> (one image, one label) and
      <em>exhaustive</em> (every image you'll encounter at inference time has a label).
      Avoid labels that are too similar for the camera to distinguish.</p>

      <h3>Class Balance</h3>
      <p>Try to collect roughly equal numbers of images per class. An imbalanced
      dataset (e.g. 200 red beads, 5 blue beads) will produce a model that is
      biased towards the majority class.</p>

      <h3>Validation Split</h3>
      <p>JumpNet automatically holds out 20% of each class as a validation set
      during training. The model never sees these images during training — they
      are used only to measure generalisation.</p>

      <div class="callout">
        Try the <strong>Dataset</strong> page to see all your collected images
        and their labels.
      </div>
    `,
  },
  {
    id: 'confidence-scores',
    icon: '📊',
    title: 'Understanding Confidence Scores',
    difficulty: 'intermediate',
    duration: '10 min',
    desc: 'What does 0.97 actually mean? When should you trust the model?',
    body: `
      <p>When JumpNet classifies an image it returns a <code>confidenceScore</code>
      between 0 and 1. This is the <em>softmax probability</em> the network assigns
      to its top prediction.</p>

      <h3>What It Means</h3>
      <p>A score of 0.97 means the network assigns 97% of its probability mass to
      that class and only 3% to all others combined. High confidence is good — but
      it is not infallible.</p>

      <h3>When to Be Suspicious</h3>
      <ul>
        <li>The input image shows something the model has never seen (out-of-distribution).</li>
        <li>Two classes look very similar under the camera's conditions.</li>
        <li>The training set was too small or unbalanced.</li>
      </ul>

      <h3>Setting a Threshold</h3>
      <p>In production you often reject predictions below a threshold (e.g. 0.80)
      and ask the user to retry. The right threshold depends on the cost of a
      wrong answer in your application.</p>

      <pre><code>if result["confidenceScore"] &lt; 0.80:
    print("Uncertain — please try again")</code></pre>
    `,
  },
  {
    id: 'cep-protocol',
    icon: '📡',
    title: 'CEP: Capability Exchange Protocol',
    difficulty: 'intermediate',
    duration: '15 min',
    desc: 'How JumpNet discovers and communicates with sensor devices.',
    body: `
      <p>CEP (Capability Exchange Protocol) is a lightweight JSON-based protocol
      for IoT devices to advertise what sensors they have and what measurements
      they can provide.</p>

      <h3>Device Registration</h3>
      <p>When an Arduino or MicroPython device boots on the network, it sends its
      CEP document to <code>POST /devices/register</code>. The server stores it
      and makes it queryable.</p>

      <pre><code>{
  "device": { "id": "esp32-a1b2", "model": "ESP32-S3", "class": "microcontroller" },
  "capabilities": [
    { "type": "sensor", "provides": ["temperature", "humidity"], "driver": "bme280" },
    { "type": "camera", "resolution": "1280x720", "format": "jpeg" }
  ]
}</code></pre>

      <h3>Discovery</h3>
      <p>Use <code>GET /devices</code> to list all registered devices, or
      <code>GET /devices/query/provides/temperature</code> to find all thermometers.</p>

      <div class="callout tip">
        Check the <code>clients/micropython/cep.py</code> file on your USB drive
        for a ready-to-use CEP client for ESP32 / Pico W.
      </div>
    `,
  },
];

export function renderLessons(el, _subId, navigate) {
  el.innerHTML = `
    <h1>📚 Lessons</h1>
    <p class="page-subtitle">Structured reading to build your understanding of AI and JumpNet.</p>

    <div style="margin-bottom:16px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn btn-sm btn-secondary filter-btn active" data-diff="all">All</button>
      <button class="btn btn-sm btn-secondary filter-btn" data-diff="beginner">Beginner</button>
      <button class="btn btn-sm btn-secondary filter-btn" data-diff="intermediate">Intermediate</button>
      <button class="btn btn-sm btn-secondary filter-btn" data-diff="advanced">Advanced</button>
    </div>

    <div class="card-grid" id="lessons-grid"></div>
  `;

  const grid = el.querySelector('#lessons-grid');

  function renderGrid(diff) {
    grid.innerHTML = '';
    LESSONS.filter(l => diff === 'all' || l.difficulty === diff).forEach(lesson => {
      const card = document.createElement('a');
      card.className = 'card-link';
      card.href = '#';
      card.innerHTML = `
        <span class="card-icon">${lesson.icon}</span>
        <div class="card-title">${lesson.title}</div>
        <div class="card-desc">${lesson.desc}</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <span class="card-badge badge-lesson diff-${lesson.difficulty}">${lesson.difficulty}</span>
          <span style="font-size:12px;color:var(--text-muted)">⏱ ${lesson.duration}</span>
        </div>
      `;
      card.addEventListener('click', e => { e.preventDefault(); navigate('lessons', lesson.id); });
      grid.appendChild(card);
    });
  }

  renderGrid('all');

  el.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid(btn.dataset.diff);
    });
  });
}

export function renderLesson(el, id, navigate) {
  const lesson = LESSONS.find(l => l.id === id);
  if (!lesson) { el.innerHTML = '<p>Lesson not found.</p>'; return; }

  el.innerHTML = `
    <a class="back-link" id="back">← Back to Lessons</a>
    <div class="article">
      <h1>${lesson.icon} ${lesson.title}</h1>
      <div class="meta">
        <span class="diff-${lesson.difficulty}">${lesson.difficulty}</span>
        <span>⏱ ${lesson.duration}</span>
      </div>
      ${lesson.body}
    </div>
  `;
  el.querySelector('#back').addEventListener('click', e => {
    e.preventDefault(); navigate('lessons');
  });
}
