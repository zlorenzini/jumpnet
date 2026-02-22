#!/usr/bin/env python3
"""
server/ml/train.py

Trains a small MobileNetV2 image classifier on a local dataset directory.
Invoked as a subprocess by the Node.js /train route.

Input  (stdin): JSON  { "datasetPath": str, "labels": [str], "epochs": int, "modelDir": str }
Output (stdout): JSON { "status": "ok"|"error", "epochs": int, "accuracy": float,
                        "modelPath": str, "labels": [str], "message": str? }

Usage:
    echo '{"datasetPath":"/path/to/dataset","labels":["a","b"],"epochs":5,"modelDir":"/path/to/models/current"}' | python train.py
"""

import sys, json, os, io, time

def fail(msg: str):
    print(json.dumps({"status": "error", "message": msg}), flush=True)
    sys.exit(1)

# ── Read config from stdin ─────────────────────────────────────────────────────
try:
    config = json.loads(sys.stdin.read())
except Exception as e:
    fail(f"Invalid JSON input: {e}")

dataset_path = config.get("datasetPath", "")
labels       = config.get("labels", [])
epochs       = int(config.get("epochs", 5))
model_dir    = config.get("modelDir", "")
img_size     = int(config.get("imageSize", 224))
batch_size   = int(config.get("batchSize", 16))

if not dataset_path or not os.path.isdir(dataset_path):
    fail(f"datasetPath not found: {dataset_path}")
if not model_dir:
    fail("modelDir is required")
os.makedirs(model_dir, exist_ok=True)

# ── Imports (deferred so errors are reported via JSON) ─────────────────────────
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torchvision import datasets, transforms, models
    from torch.utils.data import DataLoader, Subset
    import random
except ImportError as e:
    fail(f"Missing dependency: {e}. Install with: pip install torch torchvision")

# ── Device ────────────────────────────────────────────────────────────────────
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(json.dumps({"status": "progress", "message": f"Using device: {device}"}), flush=True)

# ── Dataset ───────────────────────────────────────────────────────────────────
transform = transforms.Compose([
    transforms.Resize((img_size, img_size)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

try:
    full_dataset = datasets.ImageFolder(dataset_path, transform=transform)
except Exception as e:
    fail(f"Failed to load dataset from {dataset_path}: {e}")

if len(full_dataset) == 0:
    fail("Dataset is empty — upload images first.")

# Use discovered class names if labels not specified
if not labels:
    labels = full_dataset.classes

num_classes = len(full_dataset.classes)
print(json.dumps({"status": "progress", "message": f"Classes: {full_dataset.classes}, images: {len(full_dataset)}"}), flush=True)

# Train/val split (80/20)
indices = list(range(len(full_dataset)))
random.shuffle(indices)
split   = max(1, int(0.8 * len(indices)))
train_idx, val_idx = indices[:split], indices[split:]

train_loader = DataLoader(Subset(full_dataset, train_idx), batch_size=batch_size, shuffle=True,  num_workers=0)
val_loader   = DataLoader(Subset(full_dataset, val_idx),   batch_size=batch_size, shuffle=False, num_workers=0)

# ── Model ─────────────────────────────────────────────────────────────────────
model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
# Replace classifier head for our number of classes
in_features = model.classifier[1].in_features
model.classifier[1] = nn.Linear(in_features, num_classes)
model = model.to(device)

criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=1e-4)
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=max(1, epochs // 2), gamma=0.5)

# ── Training loop ─────────────────────────────────────────────────────────────
best_acc   = 0.0
best_state = None

for epoch in range(1, epochs + 1):
    # Train
    model.train()
    train_loss = 0.0
    for imgs, lbls in train_loader:
        imgs, lbls = imgs.to(device), lbls.to(device)
        optimizer.zero_grad()
        loss = criterion(model(imgs), lbls)
        loss.backward()
        optimizer.step()
        train_loss += loss.item()

    # Validate
    model.eval()
    correct = total = 0
    with torch.no_grad():
        for imgs, lbls in val_loader:
            imgs, lbls = imgs.to(device), lbls.to(device)
            preds = model(imgs).argmax(dim=1)
            correct += (preds == lbls).sum().item()
            total   += lbls.size(0)

    acc = correct / total if total > 0 else 0.0
    if acc > best_acc:
        best_acc   = acc
        best_state = {k: v.clone() for k, v in model.state_dict().items()}

    scheduler.step()
    print(json.dumps({"status": "progress", "epoch": epoch, "epochs": epochs,
                      "trainLoss": round(train_loss / max(1, len(train_loader)), 4),
                      "valAccuracy": round(acc, 4)}), flush=True)

# ── Save ──────────────────────────────────────────────────────────────────────
model_path    = os.path.join(model_dir, "model.pth")
metadata_path = os.path.join(model_dir, "metadata.json")

if best_state:
    model.load_state_dict(best_state)
torch.save(model.state_dict(), model_path)

metadata = {
    "labels":       labels,
    "classes":      full_dataset.classes,
    "numClasses":   num_classes,
    "imageSize":    img_size,
    "architecture": "mobilenet_v2",
    "trainedAt":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "epochs":       epochs,
    "accuracy":     round(best_acc, 4),
    "device":       str(device),
}
with open(metadata_path, "w") as f:
    json.dump(metadata, f, indent=2)

print(json.dumps({
    "status":    "ok",
    "epochs":    epochs,
    "accuracy":  round(best_acc, 4),
    "modelPath": model_dir,
    "labels":    labels,
}), flush=True)
