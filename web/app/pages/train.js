/** Train page — configure, launch, and monitor a MobileNetV2 training job */
import { toast } from '../app.js';

export function renderTrain(el) {
  el.innerHTML = `
    <h1>🧠 Train</h1>
    <p class="page-subtitle">Fine-tune a MobileNetV2 classifier on your dataset using the local GPU.</p>

    <!-- ── Config card ── -->
    <div class="card" id="train-config-card">
      <h2 style="margin-top:0">New Training Job</h2>

      <div class="train-form-grid">
        <div class="form-row">
          <label>Dataset ID <span class="label-hint">(folder name from Dataset page)</span></label>
          <input type="text" id="train-dataset" placeholder="e.g. beads">
        </div>
        <div class="form-row">
          <label>Bundle ID <span class="label-hint">(output model name)</span></label>
          <input type="text" id="train-bundle" placeholder="current" value="current">
        </div>
        <div class="form-row">
          <label>Epochs</label>
          <input type="number" id="train-epochs" value="10" min="1" max="200">
        </div>
        <div class="form-row">
          <label>Batch Size <span class="label-hint">(auto-set to 32 on GPU)</span></label>
          <input type="number" id="train-batch" value="16" min="1" max="256">
        </div>
        <div class="form-row">
          <label>Image Size (px)</label>
          <input type="number" id="train-imgsize" value="224" min="64" max="640">
        </div>
      </div>

      <div class="btn-group">
        <button class="btn btn-primary" id="start-btn">▶ Start Training</button>
        <button class="btn btn-secondary" id="refresh-jobs-btn">↻ Refresh Jobs</button>
      </div>
    </div>

    <!-- ── Active job panel ── -->
    <div class="card train-job-panel" id="active-job-card" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
        <div>
          <h2 style="margin:0" id="aj-title">Training…</h2>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px" id="aj-meta"></div>
        </div>
        <div class="btn-group" style="margin:0">
          <button class="btn btn-sm btn-secondary" id="aj-stop-btn">⏹ Stop</button>
          <button class="btn btn-sm btn-success"   id="aj-export-btn" style="display:none">📦 Export ONNX</button>
        </div>
      </div>

      <!-- Epoch progress -->
      <div style="margin-top:18px">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-muted);margin-bottom:6px">
          <span id="aj-epoch-label">Epoch 0 / ?</span>
          <span id="aj-acc-label"></span>
        </div>
        <div class="progress-bar-wrap" style="height:10px">
          <div class="progress-bar" id="aj-epoch-bar" style="width:0%"></div>
        </div>
      </div>

      <!-- Metrics row -->
      <div class="train-metrics" id="aj-metrics" style="display:none">
        <div class="metric-chip">
          <span class="metric-label">Loss</span>
          <span class="metric-value" id="m-loss">—</span>
        </div>
        <div class="metric-chip">
          <span class="metric-label">Val Acc</span>
          <span class="metric-value" id="m-acc">—</span>
        </div>
        <div class="metric-chip">
          <span class="metric-label">Status</span>
          <span class="metric-value" id="m-status">—</span>
        </div>
      </div>

      <!-- Log console -->
      <div class="train-log-wrap">
        <div class="train-log-header">
          <span>Log</span>
          <button class="btn btn-sm btn-secondary" id="aj-clear-log-btn" style="padding:2px 8px;font-size:11px">Clear</button>
        </div>
        <pre class="train-log" id="aj-log"></pre>
      </div>

      <!-- Export result -->
      <div class="train-export-result card" id="aj-export-result" style="display:none;margin-top:12px;background:rgba(52,211,153,.06);border-color:rgba(52,211,153,.3)">
        <div style="font-weight:700;color:var(--accent3);margin-bottom:4px">✅ Exported to ONNX</div>
        <div style="font-size:13px;color:var(--text-muted)" id="aj-export-detail"></div>
      </div>
    </div>

    <!-- ── Job history ── -->
    <h2 style="margin-top:28px;margin-bottom:12px">Job History</h2>
    <div id="jobs-list"><p style="color:var(--text-muted)">No jobs yet.</p></div>
  `;

  // ── Refs ───────────────────────────────────────────────────────────────────
  const startBtn      = el.querySelector('#start-btn');
  const refreshBtn    = el.querySelector('#refresh-jobs-btn');
  const activeCard    = el.querySelector('#active-job-card');
  const ajTitle       = el.querySelector('#aj-title');
  const ajMeta        = el.querySelector('#aj-meta');
  const ajStopBtn     = el.querySelector('#aj-stop-btn');
  const ajExportBtn   = el.querySelector('#aj-export-btn');
  const ajEpochLabel  = el.querySelector('#aj-epoch-label');
  const ajAccLabel    = el.querySelector('#aj-acc-label');
  const ajEpochBar    = el.querySelector('#aj-epoch-bar');
  const ajMetrics     = el.querySelector('#aj-metrics');
  const ajLog         = el.querySelector('#aj-log');
  const ajClearLogBtn = el.querySelector('#aj-clear-log-btn');
  const ajExportResult= el.querySelector('#aj-export-result');
  const ajExportDetail= el.querySelector('#aj-export-detail');
  const jobsList      = el.querySelector('#jobs-list');

  let activeJobId   = null;
  let pollTimer     = null;
  let logLineCount  = 0;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function statusPill(status) {
    const map = {
      queued:  ['pill-warn',  '⏳ queued'],
      running: ['pill-warn',  '⚙️ running'],
      done:    ['pill-ok',    '✅ done'],
      stopped: ['pill-warn',  '⏹ stopped'],
      error:   ['pill-error', '❌ error'],
    };
    const [cls, label] = map[status] ?? ['pill-warn', status];
    return `<span class="pill ${cls}">${label}</span>`;
  }

  function appendLog(lines) {
    if (!Array.isArray(lines)) return;
    const newLines = lines.slice(logLineCount);
    if (!newLines.length) return;
    logLineCount += newLines.length;
    ajLog.textContent += newLines.join('\n') + '\n';
    ajLog.scrollTop = ajLog.scrollHeight;
  }

  function updateActivePanel(job) {
    if (!job) return;
    const p = job.progress ?? {};
    const epochs = p.epochs ?? '?';
    const epoch  = p.epoch  ?? 0;

    ajTitle.textContent = `Job: ${job.bundleId}`;
    ajMeta.textContent  = `dataset: ${job.datasetId}  ·  id: ${job.id.slice(0, 8)}…  ·  ${statusPill(job.status).replace(/<[^>]+>/g,'')}`;

    ajEpochLabel.textContent = `Epoch ${epoch} / ${epochs}`;
    const pct = epochs === '?' ? 0 : Math.round((epoch / epochs) * 100);
    ajEpochBar.style.width = `${pct}%`;

    if (p.valAccuracy !== undefined) {
      ajAccLabel.textContent = `Val acc: ${(p.valAccuracy * 100).toFixed(1)}%`;
      ajMetrics.style.display = 'flex';
      el.querySelector('#m-loss').textContent   = p.trainLoss?.toFixed(4) ?? '—';
      el.querySelector('#m-acc').textContent    = `${(p.valAccuracy * 100).toFixed(1)}%`;
      el.querySelector('#m-status').textContent = job.status;
    }

    const done = job.status === 'done' || job.status === 'stopped';
    ajStopBtn.style.display   = done ? 'none' : '';
    ajExportBtn.style.display = job.status === 'done' ? '' : 'none';

    if (done) stopPolling();
  }

  // ── Polling ────────────────────────────────────────────────────────────────
  async function pollJob(jobId) {
    try {
      const [jobRes, logRes] = await Promise.all([
        fetch(`/train/${jobId}`),
        fetch(`/train/${jobId}/logs`),
      ]);
      const job  = await jobRes.json();
      const logs = await logRes.json();
      updateActivePanel(job);
      appendLog(logs.logs);
    } catch (err) {
      ajLog.textContent += `[poll error] ${err.message}\n`;
    }
  }

  function startPolling(jobId) {
    stopPolling();
    activeJobId  = jobId;
    logLineCount = 0;
    ajLog.textContent = '';
    activeCard.style.display = '';
    pollJob(jobId);
    pollTimer = setInterval(() => pollJob(jobId), 1500);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ── Start training ─────────────────────────────────────────────────────────
  startBtn.addEventListener('click', async () => {
    const datasetId = el.querySelector('#train-dataset').value.trim();
    const bundleId  = el.querySelector('#train-bundle').value.trim() || 'current';
    const epochs    = parseInt(el.querySelector('#train-epochs').value)   || 10;
    const batchSize = parseInt(el.querySelector('#train-batch').value)    || 16;
    const imageSize = parseInt(el.querySelector('#train-imgsize').value)  || 224;

    if (!datasetId) { toast('Enter a dataset ID', 'error'); return; }

    startBtn.disabled = true;
    try {
      const r = await fetch('/train', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ datasetId, bundleId, epochs, batchSize, imageSize }),
      });
      const job = await r.json();
      if (!r.ok) { toast(job.error ?? 'Failed to start job', 'error'); return; }
      toast(`Job started: ${job.id.slice(0, 8)}…`, 'success');
      ajExportResult.style.display = 'none';
      ajMetrics.style.display = 'none';
      startPolling(job.id);
      loadJobs();
    } catch (err) {
      toast(`Error: ${err.message}`, 'error');
    } finally {
      startBtn.disabled = false;
    }
  });

  // ── Stop job ───────────────────────────────────────────────────────────────
  ajStopBtn.addEventListener('click', async () => {
    if (!activeJobId) return;
    try {
      await fetch(`/train/${activeJobId}/stop`, { method: 'POST' });
      toast('Stop requested', 'info');
    } catch (err) {
      toast(`Error: ${err.message}`, 'error');
    }
  });

  // ── Export ONNX ────────────────────────────────────────────────────────────
  ajExportBtn.addEventListener('click', async () => {
    if (!activeJobId) return;
    ajExportBtn.disabled = true;
    ajExportBtn.textContent = '⏳ Exporting…';
    try {
      const r = await fetch(`/train/${activeJobId}/export`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) { toast(data.detail ?? 'Export failed', 'error'); return; }
      ajExportResult.style.display = '';
      ajExportDetail.textContent   = `${data.onnxPath}  (${data.sizeKb} KB, opset ${data.opset})`;
      toast('Exported to ONNX ✅', 'success');
    } catch (err) {
      toast(`Export error: ${err.message}`, 'error');
    } finally {
      ajExportBtn.disabled = false;
      ajExportBtn.textContent = '📦 Export ONNX';
    }
  });

  // ── Clear log ──────────────────────────────────────────────────────────────
  ajClearLogBtn.addEventListener('click', () => { ajLog.textContent = ''; });

  // ── Job history ────────────────────────────────────────────────────────────
  async function loadJobs() {
    try {
      const r    = await fetch('/train');
      const jobs = await r.json();
      if (!jobs.length) {
        jobsList.innerHTML = '<p style="color:var(--text-muted)">No jobs yet.</p>';
        return;
      }
      const rows = [...jobs].reverse().map(j => {
        const p   = j.progress ?? {};
        const acc = p.valAccuracy !== undefined ? `${(p.valAccuracy * 100).toFixed(1)}%` : '—';
        return `
          <tr>
            <td class="mono">${j.id.slice(0, 8)}…</td>
            <td>${j.datasetId}</td>
            <td>${j.bundleId}</td>
            <td>${statusPill(j.status)}</td>
            <td>${acc}</td>
            <td style="font-size:12px;color:var(--text-muted)">${j.createdAt?.slice(0,16).replace('T',' ') ?? ''}</td>
            <td>
              <button class="btn btn-sm btn-secondary job-view-btn" data-id="${j.id}">View</button>
            </td>
          </tr>
        `;
      }).join('');
      jobsList.innerHTML = `
        <div class="card" style="padding:0;overflow:hidden">
          <table class="data-table">
            <thead>
              <tr><th>ID</th><th>Dataset</th><th>Bundle</th><th>Status</th><th>Best Acc</th><th>Started</th><th></th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
      jobsList.querySelectorAll('.job-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          startPolling(btn.dataset.id);
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    } catch (err) {
      jobsList.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
    }
  }

  refreshBtn.addEventListener('click', loadJobs);

  // ── Init ───────────────────────────────────────────────────────────────────
  loadJobs();
}
