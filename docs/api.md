# JumpNet API Reference

JumpNet is a Node.js gateway that exposes a unified REST API over [JumpSmartsRuntime](../launcher/JumpSmartsRuntime) (port 7312).  
Default port: **4080** — configurable via `PORT` env var.  
Upstream URL: **http://localhost:7312** — configurable via `JUMPSMARTS_URL` env var.

---

## Base URL

```
http://localhost:4080
```

---

## Endpoints

### `GET /status`

Returns JumpNet and upstream health.

**Response 200**
```json
{
  "jumpnet":  { "status": "ok", "uptimeSeconds": 42 },
  "upstream": { "status": "ok", "url": "http://localhost:7312" },
  "timestamp": "2026-02-21T12:00:00.000Z"
}
```

---

### `POST /infer`

Run image classification against a loaded model bundle.

**Content-Type:** `multipart/form-data` OR `application/json`

**Multipart fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | file | ✓ | Image to classify |
| `bundleId` | string | — | Target bundle; auto-selects if omitted |

**JSON body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | string | ✓ | Base64-encoded image |
| `bundleId` | string | — | Target bundle ID |

**Response 200**
```json
{
  "bundleId":       "abc123",
  "output":         "red-round",
  "confidenceScore": 0.97,
  "elapsedMs":      48
}
```

---

### `POST /embed`

Generate a vector embedding for text.

**Request body**
```json
{ "text": "round red bead", "model": "jumpnet-stub-v0", "dimensions": 128 }
```

**Response 200**
```json
{
  "embedding":   [0.12, -0.34, ...],
  "dimensions":  128,
  "model":       "jumpnet-stub-v0",
  "inputLength": 14
}
```

---

### `GET /dataset/list`

List all datasets.

**Response 200** — array of `DatasetSummary`
```json
[
  { "name": "beads-2024", "labelCount": 4, "imageCount": 240, "sizeBytes": 1048576 }
]
```

---

### `GET /dataset/:name`

Get details for a dataset, including labels and filenames.

**Response 200**
```json
{
  "name": "beads-2024",
  "labels": {
    "red-round": ["img_001.jpg", "img_002.jpg"],
    "blue-flat":  ["img_100.jpg"]
  }
}
```

---

### `POST /dataset/upload`

Upload one image into a dataset.

**Content-Type:** `multipart/form-data`

| Field | Required | Description |
|-------|----------|-------------|
| `file` | ✓ | Image file |
| `dataset` | ✓ | Dataset name (created if absent) |
| `label` | ✓ | Class label |

**Response 201**
```json
{ "saved": "red-round/img_003.jpg" }
```

---

### `DELETE /dataset/:name/:label/:filename`

Delete a single image from a dataset.

**Response 204** — No content.

---

### `GET /dataset/:name/image/:label/:filename`

Retrieve a raw image from a dataset.

**Response 200** — binary image with appropriate `Content-Type`.

---

### `POST /compose`

Run a sequential inference pipeline over multiple bundles.

**Request body**
```json
{
  "image": "<base64>",
  "pipeline": [
    { "bundleId": "abc123" },
    { "bundleId": "def456" }
  ]
}
```

**Response 200**
```json
{
  "steps": [
    { "bundleId": "abc123", "output": "bead", "confidenceScore": 0.95, "elapsedMs": 44 },
    { "bundleId": "def456", "output": "red-round", "confidenceScore": 0.91, "elapsedMs": 38 }
  ],
  "finalOutput":    "red-round",
  "totalElapsedMs": 90
}
```

---

### `POST /imprint`

Start a fine-tuning job ("imprint") on a dataset.

**Request body**
```json
{ "dataset": "beads-2024", "epochs": 20, "learningRate": 0.001 }
```

**Response 202**
```json
{ "id": "job-abc123", "status": "Running", "dataset": "beads-2024", "epochs": 20 }
```

---

### `GET /imprint`

List all imprint jobs.

---

### `GET /imprint/:id`

Get status of a specific imprint job.

---

### `GET /imprint/:id/logs`

Get training logs for a job.

**Response 200**
```json
{ "id": "job-abc123", "logs": ["Epoch 1/20 — loss: 0.412", "Epoch 2/20 — loss: 0.387"] }
```

---

### `POST /imprint/:id/stop`

Stop a running imprint job.

---

## Error responses

All errors return JSON:
```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing or invalid fields |
| 404 | Resource not found |
| 500 | Internal server error or upstream failure |
