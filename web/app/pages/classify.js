/** Classify page — upload or drag an image, run inference */
import { toast } from '../app.js';

export function renderClassify(el) {
  el.innerHTML = `
    <h1>🔍 Classify</h1>
    <p class="page-subtitle">Upload an image or drag-and-drop to classify it against a trained model.</p>

    <div class="card" id="upload-card">
      <div class="drop-zone" id="drop-zone">
        <span class="drop-icon">🖼️</span>
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
        <button class="btn btn-primary" id="classify-btn" disabled>Classify</button>
        <button class="btn btn-secondary" id="capture-btn">📷 Capture from Camera</button>
        <button class="btn btn-secondary" id="clear-btn" style="display:none">Clear</button>
      </div>
    </div>

    <!-- ── Live camera panel ── -->
    <div class="card camera-panel" id="camera-card" style="display:none">
      <div class="camera-viewfinder">
        <video id="camera-video" autoplay playsinline muted></video>
        <canvas id="camera-canvas" style="display:none"></canvas>
      </div>
      <p style="font-size:13px;color:var(--text-muted);text-align:center;margin:10px 0 0">
        Position your object in the frame, then press <strong>📸 Snap</strong>.
      </p>
      <div class="btn-group" style="justify-content:center;margin-top:14px">
        <button class="btn btn-primary" id="snap-btn">📸 Snap</button>
        <button class="btn btn-secondary" id="camera-cancel-btn">✕ Cancel</button>
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
  const uploadCard  = el.querySelector('#upload-card');
  const cameraCard  = el.querySelector('#camera-card');
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
  const cameraVideo  = el.querySelector('#camera-video');
  const cameraCanvas = el.querySelector('#camera-canvas');
  const snapBtn      = el.querySelector('#snap-btn');
  const cameraCancelBtn = el.querySelector('#camera-cancel-btn');

  let selectedFile = null;
  let mediaStream  = null;

  // ── Drop zone ────────────────────────────────────────────────────────────────
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
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

      if (!r.ok) { toast(d.error ?? 'Inference failed', 'error'); return; }

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

  // ── Camera flow ──────────────────────────────────────────────────────────────
  captureBtn.addEventListener('click', async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'environment' },
        audio: false,
      });
      cameraVideo.srcObject = mediaStream;
      await cameraVideo.play();
      uploadCard.style.display = 'none';
      cameraCard.style.display = 'block';
      resultBox.style.display  = 'none';
    } catch (err) {
      toast(`Camera unavailable: ${err.message}`, 'error');
    }
  });

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    cameraVideo.srcObject = null;
    cameraCard.style.display  = 'none';
    uploadCard.style.display  = 'block';
  }

  cameraCancelBtn.addEventListener('click', stopCamera);

  snapBtn.addEventListener('click', async () => {
    // Draw the current video frame to an offscreen canvas
    const w = cameraVideo.videoWidth  || 960;
    const h = cameraVideo.videoHeight || 720;
    cameraCanvas.width  = w;
    cameraCanvas.height = h;
    cameraCanvas.getContext('2d').drawImage(cameraVideo, 0, 0, w, h);

    // Convert to a Blob, then treat it like a dropped file
    cameraCanvas.toBlob(async blob => {
      stopCamera();
      const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });
      setFile(file);
      await runInference(file);
    }, 'image/jpeg', 0.92);
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
