/** Classify page — upload or drag an image, run inference */
import { toast } from '../app.js';

export function renderClassify(el) {
  el.innerHTML = `
    <h1>🔍 Classify</h1>
    <p class="page-subtitle">Upload an image or drag-and-drop to classify it against a trained model.</p>

    <div class="card">
      <div class="drop-zone" id="drop-zone">
        <span class="drop-icon">📷</span>
        <div>Drag an image here, or click to browse</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">JPEG · PNG · WebP · BMP</div>
        <input type="file" id="file-input" accept="image/*" style="display:none;">
      </div>

      <div id="preview-wrap">
        <img id="preview-img" alt="Preview">
      </div>

      <div class="form-row" style="margin-top:16px;">
        <label>Bundle ID <span style="font-weight:400;color:var(--text-muted)">(optional — leave blank to auto-select)</span></label>
        <input type="text" id="bundle-id" placeholder="e.g. beads-v1">
      </div>

      <div class="btn-group">
        <button class="btn btn-primary" id="classify-btn" disabled>
          Classify
        </button>
        <button class="btn btn-secondary" id="capture-btn">
          📷 Capture from Camera
        </button>
        <button class="btn btn-secondary" id="clear-btn" style="display:none">
          Clear
        </button>
      </div>
    </div>

    <div id="infer-result" class="card">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Result</div>
      <div class="result-label" id="result-label">—</div>
      <div class="result-conf" id="result-conf"></div>
      <div class="conf-bar-wrap">
        <div class="conf-bar" id="conf-bar" style="width:0%"></div>
      </div>
      <div id="result-meta" style="font-size:12px;color:var(--text-muted);margin-top:8px;"></div>
    </div>
  `;

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const dropZone    = el.querySelector('#drop-zone');
  const fileInput   = el.querySelector('#file-input');
  const previewImg  = el.querySelector('#preview-img');
  const classifyBtn = el.querySelector('#classify-btn');
  const captureBtn  = el.querySelector('#capture-btn');
  const clearBtn    = el.querySelector('#clear-btn');
  const bundleInput = el.querySelector('#bundle-id');
  const resultBox   = el.querySelector('#infer-result');
  const resultLabel = el.querySelector('#result-label');
  const resultConf  = el.querySelector('#result-conf');
  const confBar     = el.querySelector('#conf-bar');
  const resultMeta  = el.querySelector('#result-meta');

  let selectedFile = null;

  // ── Drop zone interactions ────────────────────────────────────────────────────
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) setFile(fileInput.files[0]);
  });

  function setFile(file) {
    selectedFile = file;
    previewImg.src = URL.createObjectURL(file);
    previewImg.style.display = 'block';
    classifyBtn.disabled = false;
    clearBtn.style.display = 'inline-flex';
    resultBox.style.display = 'none';
  }

  clearBtn.addEventListener('click', () => {
    selectedFile = null;
    previewImg.style.display = 'none';
    previewImg.src = '';
    classifyBtn.disabled = true;
    clearBtn.style.display = 'none';
    resultBox.style.display = 'none';
    fileInput.value = '';
  });

  // ── Classify ─────────────────────────────────────────────────────────────────
  classifyBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    await runInference(selectedFile);
  });

  async function runInference(file) {
    classifyBtn.disabled = true;
    classifyBtn.innerHTML = '<span class="spinner"></span>Classifying…';

    const b64 = await fileToBase64(file);
    const body = { image: b64 };
    if (bundleInput.value.trim()) body.bundleId = bundleInput.value.trim();

    try {
      const r = await fetch('/infer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(10000),
      });

      const d = await r.json();

      if (!r.ok) {
        toast(d.error ?? 'Inference failed', 'error');
        return;
      }

      const pct = Math.round((d.confidenceScore ?? 0) * 100);
      resultLabel.textContent = d.output ?? '(unknown)';
      resultConf.textContent  = `Confidence: ${pct}%`;
      confBar.style.width     = `${pct}%`;
      resultMeta.textContent  = `Bundle: ${d.bundleId ?? '—'}  ·  ${d.elapsedMs ?? '—'} ms`;
      resultBox.style.display = 'block';

      toast(`Classified as "${d.output}" (${pct}%)`, 'success');
    } catch (err) {
      toast(`Error: ${err.message}`, 'error');
    } finally {
      classifyBtn.disabled = false;
      classifyBtn.textContent = 'Classify';
    }
  }

  // ── Capture from server camera ────────────────────────────────────────────────
  captureBtn.addEventListener('click', async () => {
    captureBtn.disabled = true;
    captureBtn.innerHTML = '<span class="spinner"></span>Capturing…';

    try {
      const r = await fetch('/capture', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
        signal:  AbortSignal.timeout(30000),
      });
      const d = await r.json();

      if (!r.ok) {
        toast(d.error ?? 'Capture failed', 'error');
        return;
      }

      const pct = Math.round((d.confidenceScore ?? 0) * 100);
      resultLabel.textContent = d.output ?? '(unknown)';
      resultConf.textContent  = `Confidence: ${pct}%`;
      confBar.style.width     = `${pct}%`;
      resultMeta.textContent  = `Bundle: ${d.bundleId ?? '—'}  ·  Captured + inferred in ${d.totalMs ?? '—'} ms`;
      resultBox.style.display = 'block';

      toast(`Captured: "${d.output}" (${pct}%)`, 'success');
    } catch (err) {
      toast(`Capture error: ${err.message}`, 'error');
    } finally {
      captureBtn.disabled = false;
      captureBtn.innerHTML = '📷 Capture from Camera';
    }
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
