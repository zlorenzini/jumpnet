/** Status / system health page */

export function renderStatus(el) {
  el.innerHTML = `
    <h1>📡 System Status</h1>
    <p class="page-subtitle">JumpNet server health, hardware capabilities, and connected devices.</p>

    <div class="stat-grid" id="stat-grid">
      <div class="stat-card"><div class="stat-label">JumpNet</div><div class="stat-value" id="jn-status">—</div></div>
      <div class="stat-card"><div class="stat-label">Upstream</div><div class="stat-value" id="up-status">—</div></div>
      <div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value" id="uptime">—</div></div>
      <div class="stat-card"><div class="stat-label">Timestamp</div><div class="stat-value" id="ts" style="font-size:1rem">—</div></div>
    </div>

    <h2>Hardware Capabilities</h2>
    <div class="card" id="caps-card"><p>Loading…</p></div>

    <h2>Connected Devices</h2>
    <div class="card" id="devices-card"><p>Loading…</p></div>

    <div class="btn-group">
      <button class="btn btn-secondary" id="refresh-status">↻ Refresh</button>
    </div>
  `;

  el.querySelector('#refresh-status').addEventListener('click', () => loadAll(el));
  loadAll(el);
}

async function loadAll(el) {
  await Promise.all([loadStatus(el), loadCapabilities(el), loadDevices(el)]);
}

async function loadStatus(el) {
  try {
    const r = await fetch('/status', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    el.querySelector('#jn-status').innerHTML = pill(d.jumpnet?.status);
    el.querySelector('#up-status').innerHTML = pill(d.upstream?.status);
    el.querySelector('#uptime').textContent  = formatUptime(d.jumpnet?.uptimeSeconds ?? 0);
    el.querySelector('#ts').textContent      = d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : '—';
  } catch (err) {
    el.querySelector('#jn-status').innerHTML = pill('error');
  }
}

async function loadCapabilities(el) {
  const card = el.querySelector('#caps-card');
  try {
    const r = await fetch('/capabilities', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    card.innerHTML = `
      <div class="stat-grid">
        <div>
          <div class="stat-label">Hostname</div>
          <div class="stat-value" style="font-size:1.1rem">${d.device?.hostname ?? '—'}</div>
        </div>
        <div>
          <div class="stat-label">CPU Cores</div>
          <div class="stat-value">${d.compute?.cpuCores ?? '—'}</div>
        </div>
        <div>
          <div class="stat-label">CPU Load</div>
          <div class="stat-value">${d.compute?.cpuLoad != null ? Math.round(d.compute.cpuLoad * 100) + '%' : '—'}</div>
        </div>
        <div>
          <div class="stat-label">Free Memory</div>
          <div class="stat-value" style="font-size:1.1rem">${formatBytes(d.compute?.freeMemBytes ?? 0)}</div>
        </div>
        <div>
          <div class="stat-label">GPU</div>
          <div class="stat-value" style="font-size:1rem">${d.compute?.gpu ?? 'none'}</div>
        </div>
        <div>
          <div class="stat-label">IP Address</div>
          <div class="stat-value" style="font-size:1.1rem">${d.network?.localIp ?? '—'}</div>
        </div>
      </div>
      ${d.compute?.cameras?.length ? `
        <h3>Cameras</h3>
        <p>${d.compute.cameras.join(', ')}</p>
      ` : ''}
      ${d.models?.length ? `
        <h3>Loaded Models</h3>
        <table class="data-table">
          <tr><th>Bundle ID</th><th>Labels</th><th>Accuracy</th></tr>
          ${d.models.map(m => `<tr>
            <td class="mono">${m.bundleId}</td>
            <td>${(m.labels ?? []).join(', ')}</td>
            <td>${m.accuracy != null ? Math.round(m.accuracy * 100) + '%' : '—'}</td>
          </tr>`).join('')}
        </table>
      ` : '<p>No models loaded.</p>'}
    `;
  } catch (err) {
    card.innerHTML = `<p style="color:var(--danger)">Could not load capabilities: ${err.message}</p>`;
  }
}

async function loadDevices(el) {
  const card = el.querySelector('#devices-card');
  try {
    const r = await fetch('/devices', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const devices = d.devices ?? [];
    if (!devices.length) {
      card.innerHTML = '<p>No devices registered. CEP clients will appear here when they connect.</p>';
      return;
    }
    card.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Device ID</th>
            <th>Model / Class</th>
            <th>Capabilities</th>
            <th>IP</th>
            <th>Registered</th>
          </tr>
        </thead>
        <tbody>
          ${devices.map(dev => `
            <tr>
              <td class="mono">${dev.id}</td>
              <td>${dev.model ?? dev.class ?? '—'}</td>
              <td>${(dev.capabilityTypes ?? []).join(', ') || '—'}</td>
              <td class="mono">${dev.ip ?? '—'}</td>
              <td>${dev.registeredAt ? new Date(dev.registeredAt).toLocaleTimeString() : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    card.innerHTML = `<p style="color:var(--danger)">Could not load devices: ${err.message}</p>`;
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function pill(status) {
  if (status === 'ok')          return `<span class="pill pill-ok">ok</span>`;
  if (status === 'unreachable') return `<span class="pill pill-warn">unreachable</span>`;
  return `<span class="pill pill-error">${status ?? 'error'}</span>`;
}

function formatUptime(secs) {
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function formatBytes(n) {
  if (n < 1024)         return `${n} B`;
  if (n < 1024 * 1024)  return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3)    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 ** 3)).toFixed(2)} GB`;
}
