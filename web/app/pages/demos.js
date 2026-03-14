/** Demos page — interactive in-browser demos */

const DEMOS = [
  {
    id: 'live-classify',
    icon: '🎥',
    title: 'Live Camera Classification',
    desc: 'Use your webcam to classify objects in real time.',
  },
  {
    id: 'confidence-explorer',
    icon: '📊',
    title: 'Confidence Explorer',
    desc: 'Upload an image and see the full confidence distribution across all classes.',
  },
  {
    id: 'dataset-visualiser',
    icon: '🗺️',
    title: 'Dataset Visualiser',
    desc: 'Browse all collected images organised by label.',
  },
];

export function renderDemos(el, _subId, navigate) {
  el.innerHTML = `
    <h1>🎬 Demos</h1>
    <p class="page-subtitle">Interactive, in-browser explorations of JumpNet's capabilities.</p>
    <div class="card-grid"></div>
  `;

  const grid = el.querySelector('.card-grid');
  DEMOS.forEach(demo => {
    const card = document.createElement('a');
    card.className = 'card-link';
    card.href = '#';
    card.innerHTML = `
      <span class="card-icon">${demo.icon}</span>
      <div class="card-title">${demo.title}</div>
      <div class="card-desc">${demo.desc}</div>
      <span class="card-badge badge-demo">Demo</span>
    `;
    card.addEventListener('click', e => { e.preventDefault(); navigate('demos', demo.id); });
    grid.appendChild(card);
  });
}

export function renderDemo(el, id, navigate) {
  const demo = DEMOS.find(d => d.id === id);
  if (!demo) { el.innerHTML = '<p>Demo not found.</p>'; return; }

  // Route to specific demo renderers
  const renderers = {
    'live-classify':       renderLiveClassify,
    'confidence-explorer': renderConfidenceExplorer,
    'dataset-visualiser':  renderDatasetVisualiser,
  };

  el.innerHTML = `<a class="back-link" id="back">← Back to Demos</a><div id="demo-body"></div>`;
  el.querySelector('#back').addEventListener('click', e => {
    e.preventDefault(); navigate('demos');
  });

  const body = el.querySelector('#demo-body');
  if (renderers[id]) renderers[id](body);
  else body.innerHTML = '<p>Demo coming soon.</p>';
}

// ── Live Camera Classification ─────────────────────────────────────────────────
function renderLiveClassify(el) {
  el.innerHTML = `
    <h1>🎥 Live Camera Classification</h1>
    <p class="page-subtitle">Point your webcam at an object. JumpNet will classify it every 2 seconds.</p>

    <div class="card" style="text-align:center;">
      <video id="live-video" autoplay playsinline
        style="max-width:100%;border-radius:8px;background:#000;"></video>
      <canvas id="live-canvas" style="display:none;"></canvas>
    </div>

    <div id="live-result" style="display:none;" class="card">
      <div class="result-label" id="live-label">—</div>
      <div class="result-conf" id="live-conf"></div>
      <div class="conf-bar-wrap"><div class="conf-bar" id="live-bar" style="width:0%"></div></div>
    </div>

    <div class="btn-group">
      <button class="btn btn-primary"  id="start-cam">▶ Start Camera</button>
      <button class="btn btn-secondary" id="stop-cam" disabled>⏹ Stop</button>
    </div>
    <p id="cam-error" style="color:var(--danger);font-size:13px;margin-top:8px;"></p>
  `;

  const video   = el.querySelector('#live-video');
  const canvas  = el.querySelector('#live-canvas');
  const startBtn= el.querySelector('#start-cam');
  const stopBtn = el.querySelector('#stop-cam');
  const result  = el.querySelector('#live-result');
  const labelEl = el.querySelector('#live-label');
  const confEl  = el.querySelector('#live-conf');
  const barEl   = el.querySelector('#live-bar');
  const errEl   = el.querySelector('#cam-error');

  let stream = null;
  let timer  = null;

  startBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      startBtn.disabled = true;
      stopBtn.disabled  = false;
      errEl.textContent = '';
      // Infer every 2 seconds
      timer = setInterval(captureAndInfer, 2000);
    } catch (err) {
      errEl.textContent = `Camera error: ${err.message}`;
    }
  });

  stopBtn.addEventListener('click', () => {
    clearInterval(timer);
    stream?.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    startBtn.disabled = false;
    stopBtn.disabled  = true;
    result.style.display = 'none';
  });

  async function captureAndInfer() {
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataURL = canvas.toDataURL('image/jpeg', 0.8);
    const base64  = dataURL.split(',')[1];

    try {
      const r = await fetch('/infer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64 }),
        signal:  AbortSignal.timeout(5000),
      });
      const d = await r.json();
      if (d.output) {
        result.style.display = 'block';
        labelEl.textContent  = d.output;
        const pct = Math.round((d.confidenceScore ?? 0) * 100);
        confEl.textContent   = `Confidence: ${pct}%`;
        barEl.style.width    = `${pct}%`;
      }
    } catch { /* swallow — server may be busy */ }
  }
}

// ── Confidence Explorer ────────────────────────────────────────────────────────
function renderConfidenceExplorer(el) {
  el.innerHTML = `
    <h1>📊 Confidence Explorer</h1>
    <p class="page-subtitle">Upload an image and see the full confidence distribution across all labels.</p>

    <div class="card">
      <div class="form-row">
        <label>Image</label>
        <input type="file" id="conf-file" accept="image/*">
      </div>
      <img id="conf-preview" style="max-height:200px;border-radius:8px;display:none;margin:10px 0;">
      <button class="btn btn-primary" id="conf-run" disabled>Analyse</button>
    </div>

    <div id="conf-bars" class="card" style="display:none;"></div>
  `;

  const fileInput = el.querySelector('#conf-file');
  const preview   = el.querySelector('#conf-preview');
  const runBtn    = el.querySelector('#conf-run');
  const barsEl    = el.querySelector('#conf-bars');

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    runBtn.disabled = false;
  });

  runBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="spinner"></span> Analysing…';

    const b64 = await fileToBase64(file);
    try {
      const r = await fetch('/infer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: b64 }),
      });
      const d = await r.json();
      renderBars(barsEl, d);
    } catch (err) {
      barsEl.style.display = 'block';
      barsEl.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = 'Analyse';
    }
  });

  function renderBars(el, result) {
    // Build a distribution from topK if available, otherwise just one bar
    const items = result.topK ?? [{ label: result.output, score: result.confidenceScore }];
    el.style.display = 'block';
    el.innerHTML = `<h3>Results for bundle: ${result.bundleId ?? '—'}</h3>` +
      items.map(item => {
        const pct = Math.round((item.score ?? item.confidenceScore) * 100);
        const lbl = item.label ?? item.output;
        return `
          <div style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;">
              <span>${lbl}</span><span>${pct}%</span>
            </div>
            <div class="conf-bar-wrap">
              <div class="conf-bar" style="width:${pct}%;background:var(--accent3)"></div>
            </div>
          </div>`;
      }).join('');
  }
}

// ── Dataset Visualiser ─────────────────────────────────────────────────────────
function renderDatasetVisualiser(el) {
  el.innerHTML = `
    <h1>🗺️ Dataset Visualiser</h1>
    <p class="page-subtitle">Browse all collected images organised by dataset and label.</p>
    <div id="ds-vis-body"><p>Loading datasets…</p></div>
  `;

  const body = el.querySelector('#ds-vis-body');

  fetch('/dataset/list')
    .then(r => r.json())
    .then(async datasets => {
      if (!datasets.length) {
        body.innerHTML = '<p>No datasets found. Upload some images first.</p>';
        return;
      }
      body.innerHTML = '';
      for (const ds of datasets) {
        const detail = await fetch(`/dataset/${ds.name}`).then(r => r.json());
        body.innerHTML += `
          <h2>${ds.name}</h2>
          <p>${ds.imageCount} images · ${ds.labelCount} labels · ${(ds.sizeBytes/1024).toFixed(0)} KB</p>
          ${(detail.labels ?? []).map(lbl => `
            <h3>${lbl.name} <span style="font-weight:400;font-size:13px;color:var(--text-muted)">(${lbl.imageCount} images)</span></h3>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
              ${(lbl.images ?? []).slice(0, 12).map(img => `
                <img src="/dataset/${ds.name}/image/${lbl.name}/${img}"
                  style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"
                  loading="lazy">
              `).join('')}
            </div>
          `).join('')}
        `;
      }
    })
    .catch(err => {
      body.innerHTML = `<p style="color:var(--danger)">Error loading datasets: ${err.message}</p>`;
    });
}

// ── Utility ───────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
