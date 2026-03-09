#!/usr/bin/env python3
"""
server/ml/infer_onnx.py

Drop-in replacement for infer.py using ONNX Runtime.
Targets the Qualcomm Hexagon NPU (QNN HTP Execution Provider) on Snapdragon,
with automatic fallback to CPU so it also works on any ARM64 Linux / proot.

Requires:
    pip install onnxruntime-qnn pillow numpy
    (onnxruntime-qnn bundles the QNN EP for ARM64;
     plain onnxruntime works too but uses CPU only)

Input  (stdin): JSON {
    "imagePath":   str,   # path to image file  (mutually exclusive with imageBase64)
    "imageBase64": str,   # base64-encoded image
    "modelDir":    str    # directory with model.onnx + metadata.json
}
Output (stdout): JSON {
    "status":     "ok" | "error",
    "prediction": str,
    "scores":     { label: float },
    "message":    str?          # only on error
}

Environment:
    QNN_BACKEND_PATH   Path to libQnnHtp.so  (default: libQnnHtp.so — let the
                       OS linker find it, or set to an absolute path when using
                       the Qualcomm AI Engine Direct SDK)
    INFER_PROVIDER     Force a specific ORT EP: "QNN" | "CPU"
                       (default: try QNN then fall back to CPU)
"""

import sys, json, os, base64, io

def fail(msg: str):
    print(json.dumps({"status": "error", "message": msg}), flush=True)
    sys.exit(1)

# ── Read config ────────────────────────────────────────────────────────────────
try:
    config = json.loads(sys.stdin.read())
except Exception as e:
    fail(f"Invalid JSON input: {e}")

image_path = config.get("imagePath")
image_b64  = config.get("imageBase64")
model_dir  = config.get("modelDir", "")

if not image_path and not image_b64:
    fail("Provide 'imagePath' or 'imageBase64'.")
if not model_dir or not os.path.isdir(model_dir):
    fail(f"modelDir not found: {model_dir}")

onnx_path     = os.path.join(model_dir, "model.onnx")
metadata_path = os.path.join(model_dir, "metadata.json")

if not os.path.isfile(onnx_path):
    fail(
        f"model.onnx not found in {model_dir}. "
        "Export it first: python server/ml/export_onnx.py"
    )
if not os.path.isfile(metadata_path):
    fail(f"metadata.json missing in {model_dir}.")

# ── Imports ────────────────────────────────────────────────────────────────────
try:
    import numpy as np
    from PIL import Image
except ImportError as e:
    fail(f"Missing dependency: {e}. Install with: pip install pillow numpy")

try:
    import onnxruntime as ort
except ImportError as e:
    fail(
        f"Missing dependency: {e}. "
        "Install with: pip install onnxruntime-qnn   "
        "(or: pip install onnxruntime  for CPU-only)"
    )

# ── Build provider list ────────────────────────────────────────────────────────
_force = os.environ.get("INFER_PROVIDER", "").upper()

def _qnn_options() -> dict:
    """Build QNN EP options targeting the Hexagon HTP (NPU) backend."""
    backend = os.environ.get("QNN_BACKEND_PATH", "libQnnHtp.so")
    return {
        "backend_path":            backend,
        "htp_performance_mode":    "burst",        # max NPU clock
        "enable_htp_fp16_precision": "1",          # FP16 on Hexagon = 2× throughput
        "htp_graph_finalization_optimization_mode": "3",  # aggressive fusion
    }

def _build_session(model_path: str) -> tuple:
    """Return (session, provider_name). Tries QNN then CPU."""
    if _force == "CPU":
        sess = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        return sess, "CPU"

    if _force == "QNN":
        opts = _qnn_options()
        sess = ort.InferenceSession(
            model_path,
            providers=[("QNNExecutionProvider", opts)],
        )
        return sess, "QNN"

    # Auto: QNN → CPU
    try:
        opts = _qnn_options()
        sess = ort.InferenceSession(
            model_path,
            providers=[("QNNExecutionProvider", opts), "CPUExecutionProvider"],
        )
        active = sess.get_providers()[0]
        provider = "QNN" if "QNN" in active else "CPU"
        return sess, provider
    except Exception:
        # QNN EP not available (e.g. desktop, non-Snapdragon device)
        sess = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        return sess, "CPU"

try:
    session, active_provider = _build_session(onnx_path)
except Exception as e:
    fail(f"Failed to load model.onnx: {e}")

# ── Load metadata ─────────────────────────────────────────────────────────────
with open(metadata_path) as f:
    meta = json.load(f)

classes  = meta.get("classes", meta.get("labels", []))
img_size = int(meta.get("imageSize", 224))

if not classes:
    fail("metadata.json has no class labels.")

# ── Load image ─────────────────────────────────────────────────────────────────
try:
    if image_path:
        img = Image.open(image_path).convert("RGB")
    else:
        raw = base64.b64decode(image_b64.split(",")[-1])
        img = Image.open(io.BytesIO(raw)).convert("RGB")
except Exception as e:
    fail(f"Failed to load image: {e}")

# ── Preprocess (ImageNet normalisation, no torchvision required) ───────────────
img  = img.resize((img_size, img_size), Image.BILINEAR)
arr  = np.array(img, dtype=np.float32) / 255.0
mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
arr  = (arr - mean) / std                    # HWC, normalised
arr  = arr.transpose(2, 0, 1)[np.newaxis]    # → NCHW  (1, 3, H, W)

# ── Inference ──────────────────────────────────────────────────────────────────
input_name = session.get_inputs()[0].name
logits     = session.run(None, {input_name: arr})[0][0]   # shape (num_classes,)

# Softmax
exp        = np.exp(logits - logits.max())
probs      = (exp / exp.sum()).tolist()

scores     = {cls: round(float(p), 4) for cls, p in zip(classes, probs)}
prediction = classes[int(np.argmax(probs))]

print(json.dumps({
    "status":     "ok",
    "prediction": prediction,
    "scores":     scores,
    "provider":   active_provider,   # "QNN" or "CPU" — informational
}), flush=True)
