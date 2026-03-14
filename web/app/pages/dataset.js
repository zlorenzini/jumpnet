/** Dataset management page */
import { toast } from '../app.js';

export function renderDataset(el) {
  el.innerHTML = `
    <h1>🗂️ Dataset Manager</h1>
    <p class="page-subtitle">Browse, upload, and manage your training images.</p>

    <!-- Upload form -->
    <div class="card" id="upload-section">
      <h2>Upload Images</h2>

      <div class="form-row">
        <label>Dataset name</label>
        <input type="text" id="ds-name" placeholder="e.g. beads">
      </div>
      <div class="form-row">
        <label>Label (class)</label>
        <input type="text" id="ds-label" placeholder="e.g. red">
      </div>
      <div class="form-row">
        <label>Images <span style="font-weight:400;color:var(--text-muted)">(multi-select supported)</span></label>
        <input type="file" id="ds-files" accept="image/*" multiple>
      </div>

      <div class="upload-progress" id="upload-progress">
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;" id="upload-status">Uploading 0 / 0</div>
        <div class="progress-bar-wrap">
          <div class="progress-bar" id="upload-bar"></div>
        </div>
      </div>

      <div class="btn-group">
        <button class="btn btn-primary" id="upload-btn">Upload</button>
      </div>
    </div>

    <!-- Dataset list -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 12px">
      <h2 style="margin:0">Your Datasets</h2>
      <button class="btn btn-sm btn-secondary" id="refresh-btn">↻ Refresh</button>
    </div>

    <div id="datasets-body">
      <p>Loading…</p>
    </div>
  `;

  const uploadBtn  = el.querySelector('#upload-btn');
  const refreshBtn = el.querySelector('#refresh-btn');

  uploadBtn.addEventListener('click', () => uploadImages(el));
  refreshBtn.addEventListener('click', () => loadDatasets(el));

  loadDatasets(el);
}

// ── Upload ────────────────────────────────────────────────────────────────────
async function uploadImages(el) {
  const dataset   = el.querySelector('#ds-name').value.trim();
  const label     = el.querySelector('#ds-label').value.trim();
  const filesInput= el.querySelector('#ds-files');
  const files     = Array.from(filesInput.files);

  if (!dataset)       { toast('Enter a dataset name',  'error'); return; }
  if (!label)         { toast('Enter a label',          'error'); return; }
  if (!files.length)  { toast('Select at least one image', 'error'); return; }

  const progressEl = el.querySelector('#upload-progress');
  const statusEl   = el.querySelector('#upload-status');
  const barEl      = el.querySelector('#upload-bar');
  progressEl.style.display = 'block';

  let done = 0;
  const uploadBtn = el.querySelector('#upload-btn');
  uploadBtn.disabled = true;

  for (const file of files) {
    statusEl.textContent = `Uploading ${done + 1} / ${files.length}  — ${file.name}`;
    barEl.style.width = `${Math.round((done / files.length) * 100)}%`;

    const form = new FormData();
    form.append('file', file);
    form.append('dataset', dataset);
    form.append('label', label);

    try {
      const r = await fetch('/dataset/upload', { method: 'POST', body: form });
      if (!r.ok) {
        const d = await r.json();
        toast(`Failed: ${d.error}`, 'error');
      }
    } catch (err) {
      toast(`Upload error: ${err.message}`, 'error');
    }
    done++;
  }

  barEl.style.width = '100%';
  statusEl.textContent = `Done — uploaded ${done} image${done !== 1 ? 's' : ''}`;
  toast(`Uploaded ${done} image${done !== 1 ? 's' : ''} to ${dataset}/${label}`, 'success');
  uploadBtn.disabled = false;
  filesInput.value = '';

  setTimeout(() => {
    progressEl.style.display = 'none';
    barEl.style.width = '0%';
  }, 3000);

  loadDatasets(el);
}

// ── List datasets ─────────────────────────────────────────────────────────────
async function loadDatasets(el) {
  const body = el.querySelector('#datasets-body');
  body.innerHTML = '<p>Loading…</p>';
  try {
    const r = await fetch('/dataset/list');
    const datasets = await r.json();

    if (!datasets.length) {
      body.innerHTML = '<p>No datasets yet. Upload some images above.</p>';
      return;
    }

    body.innerHTML = datasets.map(datasetSection).join('');

    // Load detailed label rows
    await loadLabelRows(body);

  } catch (err) {
    body.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

function datasetSection(ds) {
  return `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2 style="margin:0">${ds.name}</h2>
        <span style="font-size:13px;color:var(--text-muted)">
          ${ds.imageCount} images · ${ds.labelCount} label${ds.labelCount !== 1 ? 's' : ''} · ${formatBytes(ds.sizeBytes)}
        </span>
      </div>
      <table class="data-table">
        <thead>
          <tr><th>Label</th><th>Images</th><th>Preview</th></tr>
        </thead>
        <tbody id="tbody-${ds.name}">
          <tr><td colspan="3" style="color:var(--text-muted)">Loading labels…</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

async function loadLabelRows(body) {
  const tbodies = body.querySelectorAll('[id^="tbody-"]');
  for (const tbody of tbodies) {
    const dsName = tbody.id.replace('tbody-', '');
    try {
      const r  = await fetch(`/dataset/${dsName}`);
      const ds = await r.json();
      tbody.innerHTML = (ds.labels ?? []).map(lbl => `
        <tr>
          <td>${lbl.name}</td>
          <td>${lbl.imageCount}</td>
          <td>
            <div style="display:flex;gap:4px;flex-wrap:wrap;">
              ${(lbl.images ?? []).slice(0, 6).map(img => `
                <img src="/dataset/${dsName}/image/${lbl.name}/${img}"
                  style="width:48px;height:48px;object-fit:cover;border-radius:5px;border:1px solid var(--border);"
                  loading="lazy">
              `).join('')}
            </div>
          </td>
        </tr>
      `).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="3" style="color:var(--danger)">Error loading labels</td></tr>';
    }
  }
}

function formatBytes(n) {
  if (n < 1024)         return `${n} B`;
  if (n < 1024 * 1024)  return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
