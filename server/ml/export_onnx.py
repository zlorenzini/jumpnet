#!/usr/bin/env python3
"""
server/ml/export_onnx.py

Export a trained MobileNetV2 model.pth → model.onnx.
Run this ONCE on the machine that holds the .pth weights (e.g. the CM5),
then copy model.onnx + metadata.json to the Android device.

Usage:
    python export_onnx.py [--model-dir /path/to/models/current]

Output:
    <modelDir>/model.onnx
"""

import argparse, json, os, sys

def fail(msg: str):
    print(f"[export_onnx] ERROR: {msg}", file=sys.stderr)
    sys.exit(1)

# ── Args ───────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Export JumpNet .pth model to ONNX")
parser.add_argument(
    "--model-dir",
    default=os.path.join(os.path.dirname(__file__), "..", "..", "models", "current"),
    help="Directory containing model.pth and metadata.json (default: models/current)",
)
parser.add_argument(
    "--opset", type=int, default=17,
    help="ONNX opset version (default: 17)",
)
args = parser.parse_args()

model_dir     = os.path.realpath(args.model_dir)
model_path    = os.path.join(model_dir, "model.pth")
metadata_path = os.path.join(model_dir, "metadata.json")
onnx_path     = os.path.join(model_dir, "model.onnx")

if not os.path.isfile(model_path):
    fail(f"model.pth not found in {model_dir}. Train a model first via POST /train.")
if not os.path.isfile(metadata_path):
    fail(f"metadata.json not found in {model_dir}.")

# ── Imports ────────────────────────────────────────────────────────────────────
try:
    import torch
    import torch.nn as nn
    from torchvision import models
except ImportError as e:
    fail(f"Missing dependency: {e}. Install with: pip install torch torchvision")

# ── Load metadata ─────────────────────────────────────────────────────────────
with open(metadata_path) as f:
    meta = json.load(f)

classes   = meta.get("classes", meta.get("labels", []))
img_size  = meta.get("imageSize", 224)
num_cls   = meta.get("numClasses", len(classes))

print(f"[export_onnx] Model dir : {model_dir}")
print(f"[export_onnx] Classes   : {classes}")
print(f"[export_onnx] Image size: {img_size}x{img_size}")
print(f"[export_onnx] Opset     : {args.opset}")

# ── Load model ─────────────────────────────────────────────────────────────────
model = models.mobilenet_v2(weights=None)
model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_cls)
model.load_state_dict(torch.load(model_path, map_location="cpu"))
model.eval()

# ── Export ─────────────────────────────────────────────────────────────────────
dummy = torch.randn(1, 3, img_size, img_size)

torch.onnx.export(
    model, dummy, onnx_path,
    input_names=["image"],
    output_names=["logits"],
    dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
    opset_version=args.opset,
    do_constant_folding=True,
)

size_kb = os.path.getsize(onnx_path) / 1024
print(f"[export_onnx] Exported  : {onnx_path}  ({size_kb:.0f} KB)")
print(f"[export_onnx] Done. Copy model.onnx + metadata.json to the Android device.")
