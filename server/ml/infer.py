#!/usr/bin/env python3
"""
server/ml/infer.py

Runs inference on a single image using a trained MobileNetV2 model.
Invoked as a subprocess by the Node.js /infer route.

Input  (stdin): JSON  {
    "imagePath": str,           # path to image file (mutually exclusive with imageBase64)
    "imageBase64": str,         # base64-encoded image
    "modelDir": str             # path to directory with model.pth + metadata.json
}
Output (stdout): JSON {
    "status": "ok"|"error",
    "prediction": str,          # top predicted label
    "scores": { label: float }  # softmax scores for all classes
    "message": str?
}
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

image_path   = config.get("imagePath")
image_b64    = config.get("imageBase64")
model_dir    = config.get("modelDir", "")

if not image_path and not image_b64:
    fail("Provide 'imagePath' or 'imageBase64'.")
if not model_dir or not os.path.isdir(model_dir):
    fail(f"modelDir not found: {model_dir}")

model_path    = os.path.join(model_dir, "model.pth")
metadata_path = os.path.join(model_dir, "metadata.json")

if not os.path.isfile(model_path):
    fail(f"No model found at {model_path}. Train first via POST /train.")
if not os.path.isfile(metadata_path):
    fail(f"metadata.json missing in {model_dir}.")

# ── Imports ────────────────────────────────────────────────────────────────────
try:
    import torch
    import torch.nn as nn
    from torchvision import transforms, models
    from PIL import Image
except ImportError as e:
    fail(f"Missing dependency: {e}. Install with: pip install torch torchvision pillow")

# ── Load metadata ─────────────────────────────────────────────────────────────
with open(metadata_path) as f:
    meta = json.load(f)

classes   = meta.get("classes", meta.get("labels", []))
img_size  = meta.get("imageSize", 224)
num_cls   = meta.get("numClasses", len(classes))

if not classes:
    fail("metadata.json has no class labels.")

# ── Load model ─────────────────────────────────────────────────────────────────
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = models.mobilenet_v2(weights=None)
in_features = model.classifier[1].in_features
model.classifier[1] = nn.Linear(in_features, num_cls)
model.load_state_dict(torch.load(model_path, map_location=device))
model = model.to(device)
model.eval()

# ── Load image ─────────────────────────────────────────────────────────────────
try:
    if image_path:
        img = Image.open(image_path).convert("RGB")
    else:
        raw = base64.b64decode(image_b64.split(",")[-1])   # strip data-URI prefix if present
        img = Image.open(io.BytesIO(raw)).convert("RGB")
except Exception as e:
    fail(f"Failed to load image: {e}")

# ── Preprocess ─────────────────────────────────────────────────────────────────
transform = transforms.Compose([
    transforms.Resize((img_size, img_size)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])
tensor = transform(img).unsqueeze(0).to(device)

# ── Inference ──────────────────────────────────────────────────────────────────
with torch.no_grad():
    logits = model(tensor)
    probs  = torch.softmax(logits, dim=1)[0].cpu().tolist()

scores     = {cls: round(p, 4) for cls, p in zip(classes, probs)}
prediction = classes[probs.index(max(probs))]

print(json.dumps({
    "status":     "ok",
    "prediction": prediction,
    "scores":     scores,
}), flush=True)
