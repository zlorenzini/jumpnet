// clients/node/index.js — JumpNet Node.js client (ES module, stdlib fetch)

export class JumpNetClient {
  /** @param {string} [baseUrl] */
  constructor(baseUrl = 'http://localhost:4080') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  async #json(method, path, body = undefined) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.body    = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${this.baseUrl}${path}`, opts);
    const text = await res.text();
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}: ${text}`), { status: res.status });
    return text ? JSON.parse(text) : null;
  }

  // ── status ───────────────────────────────────────────────────────────────────
  status() { return this.#json('GET', '/status'); }

  // ── infer ────────────────────────────────────────────────────────────────────
  /**
   * @param {Buffer|string} image  Raw bytes or base64 string
   * @param {{ bundleId?: string }} [opts]
   */
  infer(image, opts = {}) {
    const b64 = Buffer.isBuffer(image) ? image.toString('base64') : image;
    return this.#json('POST', '/infer', { image: b64, ...opts });
  }

  // ── embed ────────────────────────────────────────────────────────────────────
  embed(text, { model, dimensions = 128 } = {}) {
    return this.#json('POST', '/embed', { text, dimensions, ...(model ? { model } : {}) });
  }

  // ── dataset ──────────────────────────────────────────────────────────────────
  datasetList()          { return this.#json('GET', '/dataset/list'); }
  datasetInfo(name)      { return this.#json('GET', `/dataset/${name}`); }
  datasetDelete(dataset, label, filename) {
    return this.#json('DELETE', `/dataset/${dataset}/${label}/${filename}`);
  }

  /**
   * Upload an image buffer to a dataset.
   * @param {Buffer} fileBuffer
   * @param {{ dataset: string, label: string, filename?: string }} opts
   */
  async datasetUpload(fileBuffer, { dataset, label, filename = 'image.jpg' }) {
    const boundary = `----JumpNetNodeBoundary${Date.now()}`;
    const CRLF = '\r\n';
    const makeField = (name, value) =>
      Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`);
    const fileHead = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
      `Content-Type: image/jpeg${CRLF}${CRLF}`
    );
    const tail = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
    const body = Buffer.concat([makeField('dataset', dataset), makeField('label', label), fileHead, fileBuffer, tail]);

    const res = await fetch(`${this.baseUrl}/dataset/upload`, {
      method:  'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const text = await res.text();
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}: ${text}`), { status: res.status });
    return text ? JSON.parse(text) : null;
  }

  // ── compose ──────────────────────────────────────────────────────────────────
  compose(image, pipeline) {
    const b64 = Buffer.isBuffer(image) ? image.toString('base64') : image;
    return this.#json('POST', '/compose', { image: b64, pipeline });
  }

  // ── imprint ──────────────────────────────────────────────────────────────────
  imprintStart(dataset, { epochs = 10, learningRate = 0.001 } = {}) {
    return this.#json('POST', '/imprint', { dataset, epochs, learningRate });
  }
  imprintList()             { return this.#json('GET', '/imprint'); }
  imprintStatus(id)         { return this.#json('GET',  `/imprint/${id}`); }
  imprintLogs(id)           { return this.#json('GET',  `/imprint/${id}/logs`); }
  imprintStop(id)           { return this.#json('POST', `/imprint/${id}/stop`); }
}
