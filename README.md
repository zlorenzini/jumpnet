# JumpNet

AI inference gateway for [JumpOS](https://github.com/zlorenzini/jumpstation).

Exposes a unified REST API over **JumpSmartsRuntime** (port 7312) with clients for Python, Node.js, and MicroPython.

## Quick start

```bash
cd server
npm install
npm start
# → http://localhost:4080
```

Set `JUMPSMARTS_URL` to point at a remote JumpSmartsRuntime instance (default: `http://localhost:7312`).  
Set `PORT` to change the server port (default: `4080`).

## Layout

```
jumpnet/
├── docs/
│   ├── api.md              # Full API reference
│   ├── schemas/            # JSON Schema for each endpoint
│   └── examples/           # curl / Python / Node.js examples
├── server/
│   ├── server.js           # Express entry point
│   └── routes/             # infer · embed · dataset · compose · imprint · status
└── clients/
    ├── python/             # stdlib-only Python client
    ├── node/               # ES-module Node.js client
    └── micropython/        # MicroPython client (ESP32 / Pico W)
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/status` | Health check |
| POST | `/infer` | Image classification |
| POST | `/embed` | Text → vector embedding |
| GET/POST/DELETE | `/dataset/*` | Dataset management |
| POST | `/compose` | Multi-bundle pipeline |
| POST/GET | `/imprint/*` | Fine-tuning jobs |

See [docs/api.md](docs/api.md) for the full reference.

## Client usage

**Python**
```python
from jumpnet import JumpNetClient
client = JumpNetClient("http://localhost:4080")
result = client.infer(open("bead.jpg", "rb").read())
print(result["output"], result["confidenceScore"])
```

**Node.js**
```js
import { JumpNetClient } from './clients/node/index.js';
const client = new JumpNetClient();
const result = await client.infer(fs.readFileSync('bead.jpg'));
console.log(result.output, result.confidenceScore);
```

**MicroPython**
```python
from jumpnet import JumpNetClient
client = JumpNetClient("http://192.168.1.100:4080")
result = client.infer(camera.capture())
print(result["output"])
```
