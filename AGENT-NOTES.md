# Agent Notes — jumpbox-1 (192.168.0.163)

## What needs to happen

A remote machine (a Raspberry Pi CM5 running `jumpapp-music-listener`) is trying to
compile `ast_audioset.onnx` (≈2.2 MB) into a `.dxnn` file using this JumpNet node's
DEEPX compiler.

It does this by POSTing multipart form-data to:

```
POST http://192.168.0.163:4080/compile/dxnn
```

## The problem

This JumpNet server is returning **404 Not Found** for `POST /compile/dxnn`. The route
exists in the current version of `server/routes/compile.js` but the copy running on
this machine is outdated and does not have it yet.

`GET /compile` works and correctly reports:
- `supported: true` (x86_64 ✓)
- `dxcomFound: true`
- `dxcomPath: /jump/dx-compiler/venv-dx-compiler-local/bin/dxcom`

`GET /capabilities` also correctly advertises `dx_compile` in the services list.

So dxcom is installed and ready — the server just needs to be updated.

## What to do

1. **Update `server/routes/compile.js`** with the latest version from the jumpnet
   repository. The key addition is the `POST /compile/dxnn` route (roughly line 217
   onward in the current source), which:
   - Accepts a multipart upload with fields: `model` (file), `modelName`, 
     `calibrationNum`, `inputShape`, `inputName`
   - Writes the ONNX to a temp dir
   - Calls `server/ml/compile_dxnn.py` via the dxcom Python venv
   - Streams back the `.dxnn` binary with headers `X-Elapsed-Ms` and `X-Size-Bytes`

2. **Restart the JumpNet server:**
   ```bash
   cd /jump/jumpnet
   ./start.sh stop && ./start.sh
   ```

3. **Verify the route is live:**
   ```bash
   # Should return JSON with supported/arch/dxcomFound, not 404
   node -e "fetch('http://localhost:4080/compile/dxnn',{method:'POST'}).then(r=>console.log(r.status))"
   # Expect 400 (missing file field), not 404
   ```

Once the server is restarted with the updated route, the CM5 will automatically
retry and the compilation will proceed (expect ~20 minutes).

## Compile endpoint details

The route uses multer with `memoryStorage()` and a 500 MB file size limit. It accepts:

| Field           | Type | Description                              |
|-----------------|------|------------------------------------------|
| `model`         | file | The `.onnx` file (required)              |
| `modelName`     | text | Output filename stem (default: onnx name)|
| `calibrationNum`| text | Synthetic calibration samples (default: 20) |
| `inputShape`    | text | JSON array, e.g. `"[1, 1024, 128]"`     |
| `inputName`     | text | ONNX input tensor name (default: `input_values`) |

The Python compile script is `server/ml/compile_dxnn.py`. It takes a path to a JSON
args file and uses the dxcom Python API with synthetic noise calibration (no image
dataset required for audio models).
