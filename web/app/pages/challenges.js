/** Challenges page — student exercises */

const CHALLENGES = [
  {
    id: 'three-class-sorting',
    icon: '🎯',
    title: 'Three-Class Sorter',
    difficulty: 'beginner',
    points: 100,
    desc: 'Train a model to classify three distinct objects with ≥ 90% held-out accuracy.',
    body: `
      <h3>Overview</h3>
      <p>Choose three objects you can find in the classroom. Collect at least 30 images
      per object, train a model, and achieve ≥ 90% accuracy on the held-out validation set.</p>

      <h3>Checklist</h3>
      <ol>
        <li>Choose three clearly distinguishable objects.</li>
        <li>Capture ≥ 30 images per class using the Dataset tool or a client.</li>
        <li>Hand your USB to the instructor. Ask for training with the default settings.</li>
        <li>Test your model using the Classify tool here in the browser.</li>
        <li>Show the instructor a confidence score ≥ 0.90 on a fresh object.</li>
      </ol>

      <div class="callout tip">
        <strong>Tip:</strong> Make sure each object looks different under the camera.
        Avoid objects that are the same colour or shape.
      </div>

      <h3>Stretch goal</h3>
      <p>Achieve ≥ 95% accuracy and earn a bonus 50 points.</p>
    `,
  },
  {
    id: 'five-class-challenge',
    icon: '🏅',
    title: 'Five-Class Challenge',
    difficulty: 'intermediate',
    points: 200,
    desc: 'Extend to five classes. Focus on data quality and class balance.',
    body: `
      <h3>Overview</h3>
      <p>A harder version of the Three-Class Sorter — now with five objects.
      With more classes, confusable pairs become more likely, so focus on
      data diversity.</p>

      <h3>Hints</h3>
      <ul>
        <li>Capture images at multiple distances (close, medium, far).</li>
        <li>Rotate each object to different angles.</li>
        <li>Vary the background if possible.</li>
        <li>Balance your classes — ~ the same number of images each.</li>
      </ul>

      <h3>Success criteria</h3>
      <p>≥ 85% validation accuracy across all five classes. Ask the instructor
      to show you the per-class confusion matrix.</p>
    `,
  },
  {
    id: 'micropython-buzzer',
    icon: '🔉',
    title: 'Classify & Buzz',
    difficulty: 'intermediate',
    points: 150,
    desc: 'Wire a buzzer to an ESP32. Make it beep once for class A, twice for class B.',
    body: `
      <h3>Overview</h3>
      <p>Hardware integration challenge: connect a passive buzzer to an ESP32
      and control it based on the classification result.</p>

      <h3>You will need</h3>
      <ul>
        <li>ESP32 with camera (e.g. XIAO ESP32S3 Sense)</li>
        <li>Passive buzzer + 100 Ω resistor</li>
        <li>Two objects to classify</li>
      </ul>

      <h3>Template code</h3>
      <pre><code>from machine import Pin, PWM
from jumpnet import JumpNetClient
import camera, time

client = JumpNetClient("http://192.168.1.100:4080")
buzzer = PWM(Pin(5), freq=1000, duty=0)

def beep(n):
    for _ in range(n):
        buzzer.duty(512)
        time.sleep(0.1)
        buzzer.duty(0)
        time.sleep(0.1)

camera.init(format=camera.JPEG, quality=10)

while True:
    frame  = camera.capture()
    result = client.infer(frame)
    if   result["output"] == "class_a": beep(1)
    elif result["output"] == "class_b": beep(2)
    time.sleep(1)</code></pre>
    `,
  },
  {
    id: 'poor-data-diagnosis',
    icon: '🔬',
    title: 'Diagnose a Bad Model',
    difficulty: 'intermediate',
    points: 175,
    desc: 'Given a deliberately bad dataset, identify and fix the data quality problem.',
    body: `
      <h3>Overview</h3>
      <p>The instructor will load a pre-collected dataset with intentional data quality
      issues. Your job is to diagnose the problem, collect better images, and improve
      the accuracy.</p>

      <h3>Common problems to look for</h3>
      <ul>
        <li><strong>Class imbalance</strong> — one class has far more images.</li>
        <li><strong>Label noise</strong> — images are assigned the wrong label.</li>
        <li><strong>Background leakage</strong> — the background is the same in all
            images of one class (the model learns the background, not the object).</li>
        <li><strong>Too easy a task</strong> — objects differ only in context, not appearance.</li>
      </ul>

      <h3>Your report</h3>
      <p>Write a short note (3–5 sentences) describing what you found and what you changed.
      Show before-and-after accuracy numbers.</p>
    `,
  },
  {
    id: 'speed-run',
    icon: '⚡',
    title: 'Speed Run',
    difficulty: 'advanced',
    points: 300,
    desc: 'Build and deploy a working two-class classifier in under 15 minutes.',
    body: `
      <h3>Rules</h3>
      <ol>
        <li>Timer starts when the instructor says "go".</li>
        <li>Choose two objects from the table.</li>
        <li>Collect data, train, and achieve ≥ 85% accuracy.</li>
        <li>Demonstrate live classification to the instructor.</li>
        <li>Timer stops when a correct prediction is shown.</li>
      </ol>

      <h3>Scoring</h3>
      <table class="data-table">
        <tr><th>Time</th><th>Points</th></tr>
        <tr><td>&lt; 8 min</td><td>300</td></tr>
        <tr><td>8–12 min</td><td>200</td></tr>
        <tr><td>12–15 min</td><td>100</td></tr>
        <tr><td>&gt; 15 min</td><td>50 (participation)</td></tr>
      </table>

      <div class="callout warn">
        <strong>Strategy tip:</strong> Speed comes from having a clean,
        uncluttered setup. Get your camera angle right before you start the timer.
      </div>
    `,
  },
];

export function renderChallenges(el, _subId, navigate) {
  el.innerHTML = `
    <h1>🏆 Challenges</h1>
    <p class="page-subtitle">Apply what you've learned and earn points. Show the instructor when you're done!</p>
    <div class="card-grid" id="challenges-grid"></div>
  `;

  const grid = el.querySelector('#challenges-grid');
  CHALLENGES.forEach(ch => {
    const card = document.createElement('a');
    card.className = 'card-link';
    card.href = '#';
    card.innerHTML = `
      <span class="card-icon">${ch.icon}</span>
      <div class="card-title">${ch.title}</div>
      <div class="card-desc">${ch.desc}</div>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
        <span class="card-badge badge-challenge diff-${ch.difficulty}">${ch.difficulty}</span>
        <span style="font-size:13px;color:var(--warn);font-weight:700">${ch.points} pts</span>
      </div>
    `;
    card.addEventListener('click', e => { e.preventDefault(); navigate('challenges', ch.id); });
    grid.appendChild(card);
  });
}

export function renderChallenge(el, id, navigate) {
  const ch = CHALLENGES.find(c => c.id === id);
  if (!ch) { el.innerHTML = '<p>Challenge not found.</p>'; return; }

  el.innerHTML = `
    <a class="back-link" id="back">← Back to Challenges</a>
    <div class="article">
      <h1>${ch.icon} ${ch.title}</h1>
      <div class="meta">
        <span class="diff-${ch.difficulty}">${ch.difficulty}</span>
        <span style="color:var(--warn);font-weight:700">⭐ ${ch.points} points</span>
      </div>
      ${ch.body}
    </div>
  `;
  el.querySelector('#back').addEventListener('click', e => {
    e.preventDefault(); navigate('challenges');
  });
}
