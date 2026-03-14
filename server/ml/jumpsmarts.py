#!/usr/bin/env python3
"""
server/ml/jumpsmarts.py  —  JumpSmartsRuntime

FastAPI ML backend for JumpNet.  Runs on port 7312.

Endpoints:
  GET  /status              health check
  GET  /bundles             list trained model bundles
  POST /infer               run image classification (multipart or JSON)
  POST /train               start an async training job → { id, status }
  GET  /train               list all jobs
  GET  /train/{id}          job status + result
  GET  /train/{id}/logs     streamed training log lines
  POST /train/{id}/stop     request graceful stop

Usage:
    python jumpsmarts.py
    # or via the jumpsmarts.service systemd unit
"""

import base64
import io
import json
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ── Paths ──────────────────────────────────────────────────────────────────────
_HERE      = Path(__file__).resolve().parent
DATA_DIR   = _HERE.parent.parent / "data"
MODELS_DIR = _HERE.parent.parent / "models"

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="JumpSmartsRuntime", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_started_at = time.time()

# ── In-memory job store ────────────────────────────────────────────────────────
_jobs: dict[str, dict] = {}   # job_id → job dict


# ── Model cache ───────────────────────────────────────────────────────────────
# Keyed by bundle_id → { "session": ort.InferenceSession, "meta": dict }
#                  OR  { "net": torch_net, "tf": transforms, "device": device, "meta": dict }
_model_cache: dict = {}
_cache_lock = threading.Lock()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _list_bundles() -> list[dict]:
    bundles = []
    if MODELS_DIR.exists():
        for d in sorted(MODELS_DIR.iterdir()):
            meta_f = d / "metadata.json"
            has_model = (d / "model.onnx").exists() or (d / "model.pth").exists()
            if not has_model:
                continue
            entry = {"bundleId": d.name, "backend": "onnx" if (d / "model.onnx").exists() else "torch"}
            if meta_f.exists():
                try:
                    entry.update(json.loads(meta_f.read_text()))
                except Exception:
                    pass
            bundles.append(entry)
    return bundles


def _load_image(raw_bytes: bytes):
    """Return a PIL Image from raw bytes."""
    from PIL import Image
    return Image.open(io.BytesIO(raw_bytes)).convert("RGB")


def _load_bundle_onnx(bundle_id: str, model_dir: Path, meta: dict) -> dict:
    """Load an ONNX model into an InferenceSession and cache it."""
    import numpy as np
    import onnxruntime as ort
    sess_opts = ort.SessionOptions()
    sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    session = ort.InferenceSession(
        str(model_dir / "model.onnx"),
        sess_options=sess_opts,
        providers=["CPUExecutionProvider"],
    )
    entry = {"backend": "onnx", "session": session, "meta": meta}
    with _cache_lock:
        _model_cache[bundle_id] = entry
    print(f"[jumpsmarts] Loaded ONNX bundle '{bundle_id}' ({meta.get('numClasses',0)} classes)", flush=True)
    return entry


def _load_bundle_torch(bundle_id: str, model_dir: Path, meta: dict) -> dict:
    """Load a PyTorch .pth model and cache it."""
    import torch
    import torch.nn as nn
    from torchvision import transforms, models as tv_models
    classes  = meta.get("classes") or meta.get("labels") or []
    img_size = meta.get("imageSize", 224)
    device   = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    net = tv_models.mobilenet_v2(weights=None)
    net.classifier[1] = nn.Linear(net.classifier[1].in_features, len(classes))
    net.load_state_dict(torch.load(str(model_dir / "model.pth"), map_location=device, weights_only=True))
    net.to(device).eval()
    tf = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    entry = {"backend": "torch", "net": net, "tf": tf, "device": device, "meta": meta}
    with _cache_lock:
        _model_cache[bundle_id] = entry
    print(f"[jumpsmarts] Loaded PyTorch bundle '{bundle_id}' ({len(classes)} classes)", flush=True)
    return entry


def _get_bundle(bundle_id: str) -> dict:
    """Return cached bundle entry, loading it if necessary."""
    with _cache_lock:
        cached = _model_cache.get(bundle_id)
    if cached:
        return cached

    model_dir = MODELS_DIR / bundle_id
    meta_path = model_dir / "metadata.json"

    if not meta_path.exists():
        raise HTTPException(status_code=503, detail=f"metadata.json not found for bundle '{bundle_id}'.")

    meta    = json.loads(meta_path.read_text())
    classes = meta.get("classes") or meta.get("labels") or []
    if not classes:
        raise HTTPException(status_code=503, detail="metadata.json has no class labels.")

    # Prefer ONNX (lightweight, no torch required)
    if (model_dir / "model.onnx").exists():
        try:
            return _load_bundle_onnx(bundle_id, model_dir, meta)
        except ImportError:
            pass  # onnxruntime not installed — fall through to torch

    if (model_dir / "model.pth").exists():
        try:
            return _load_bundle_torch(bundle_id, model_dir, meta)
        except ImportError as e:
            raise HTTPException(
                status_code=503,
                detail=f"No inference backend available. Install onnxruntime or torch. ({e})",
            )

    raise HTTPException(
        status_code=503,
        detail=f"No model file (model.onnx or model.pth) found for bundle '{bundle_id}'.",
    )


def _infer_onnx(entry: dict, raw_bytes: bytes) -> dict:
    import numpy as np
    meta     = entry["meta"]
    classes  = meta.get("classes") or meta.get("labels") or []
    img_size = meta.get("imageSize", 224)
    img      = _load_image(raw_bytes).resize((img_size, img_size))
    arr      = np.array(img, dtype=np.float32) / 255.0
    mean     = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std      = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr      = ((arr - mean) / std).transpose(2, 0, 1)[np.newaxis]  # NCHW
    session  = entry["session"]
    input_name = session.get_inputs()[0].name
    logits   = session.run(None, {input_name: arr})[0][0]
    # softmax
    e = np.exp(logits - logits.max())
    probs = (e / e.sum()).tolist()
    scores = {c: round(p, 4) for c, p in zip(classes, probs)}
    return classes, probs, scores


def _infer_torch(entry: dict, raw_bytes: bytes) -> tuple:
    import torch
    meta     = entry["meta"]
    classes  = meta.get("classes") or meta.get("labels") or []
    img      = _load_image(raw_bytes)
    tensor   = entry["tf"](img).unsqueeze(0).to(entry["device"])
    with torch.no_grad():
        probs = torch.softmax(entry["net"](tensor), dim=1)[0].cpu().tolist()
    scores = {c: round(p, 4) for c, p in zip(classes, probs)}
    return classes, probs, scores


def _run_infer(raw_bytes: bytes, bundle_id: str = "current") -> dict:
    """Run inference for bundle_id. ONNX preferred; falls back to PyTorch."""
    entry    = _get_bundle(bundle_id)
    backend  = entry["backend"]

    if backend == "onnx":
        classes, probs, scores = _infer_onnx(entry, raw_bytes)
    else:
        classes, probs, scores = _infer_torch(entry, raw_bytes)

    max_prob   = max(probs)
    prediction = classes[probs.index(max_prob)]

    return {
        "prediction":     prediction,
        "confidenceScore": round(max_prob, 4),
        "scores":          scores,
        "bundleId":        bundle_id,
    }


def _run_training(job_id: str, config: dict):
    """Background thread: train a MobileNetV2 model and update job state."""
    import random
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torchvision import datasets, transforms, models
    from torch.utils.data import DataLoader, Subset

    job = _jobs[job_id]
    job["status"] = "running"

    def log(msg: str):
        job["logs"].append(msg)
        print(f"[jumpsmarts:{job_id[:8]}] {msg}", flush=True)

    try:
        dataset_path = config["datasetPath"]
        model_dir    = Path(config["modelDir"])
        epochs       = int(config.get("epochs", 5))
        img_size     = int(config.get("imageSize", 224))
        batch_size   = int(config.get("batchSize", 16))

        model_dir.mkdir(parents=True, exist_ok=True)

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        log(f"Using device: {device}")

        tf = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.2, contrast=0.2),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

        full_ds = datasets.ImageFolder(dataset_path, transform=tf)
        if len(full_ds) == 0:
            raise ValueError("Dataset is empty — upload images first.")

        labels = full_ds.classes
        log(f"Classes: {labels}, images: {len(full_ds)}")

        idx   = list(range(len(full_ds)))
        random.shuffle(idx)
        split = max(1, int(0.8 * len(idx)))
        train_ld = DataLoader(Subset(full_ds, idx[:split]),  batch_size=batch_size, shuffle=True,  num_workers=0)
        val_ld   = DataLoader(Subset(full_ds, idx[split:]),  batch_size=batch_size, shuffle=False, num_workers=0)

        net = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
        net.classifier[1] = nn.Linear(net.classifier[1].in_features, len(labels))
        net = net.to(device)

        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(net.parameters(), lr=1e-4)
        scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=max(1, epochs // 2), gamma=0.5)

        best_acc, best_state = 0.0, None

        for epoch in range(1, epochs + 1):
            if job.get("stop"):
                log("Stopped by request.")
                job["status"] = "stopped"
                return

            net.train()
            train_loss = 0.0
            for imgs, lbls in train_ld:
                imgs, lbls = imgs.to(device), lbls.to(device)
                optimizer.zero_grad()
                loss = criterion(net(imgs), lbls)
                loss.backward()
                optimizer.step()
                train_loss += loss.item()

            net.eval()
            correct = total = 0
            with torch.no_grad():
                for imgs, lbls in val_ld:
                    imgs, lbls = imgs.to(device), lbls.to(device)
                    preds = net(imgs).argmax(dim=1)
                    correct += (preds == lbls).sum().item()
                    total   += lbls.size(0)

            acc = correct / total if total > 0 else 0.0
            if acc > best_acc:
                best_acc   = acc
                best_state = {k: v.clone() for k, v in net.state_dict().items()}
            scheduler.step()

            msg = f"Epoch {epoch}/{epochs}  loss={train_loss / max(1, len(train_ld)):.4f}  val_acc={acc:.4f}"
            log(msg)
            job["progress"] = {"epoch": epoch, "epochs": epochs,
                               "trainLoss": round(train_loss / max(1, len(train_ld)), 4),
                               "valAccuracy": round(acc, 4)}

        if best_state:
            net.load_state_dict(best_state)
        torch.save(net.state_dict(), str(model_dir / "model.pth"))

        # Evict any cached version of this bundle so it reloads from the new .pth
        with _cache_lock:
            _model_cache.pop(model_dir.name, None)

        metadata = {
            "labels":       labels,
            "classes":      labels,
            "numClasses":   len(labels),
            "imageSize":    img_size,
            "architecture": "mobilenet_v2",
            "trainedAt":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "epochs":       epochs,
            "accuracy":     round(best_acc, 4),
            "device":       str(device),
        }
        (model_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))

        result = {
            "status":    "ok",
            "accuracy":  round(best_acc, 4),
            "labels":    labels,
            "bundleId":  model_dir.name,
            "modelDir":  str(model_dir),
        }
        job["status"] = "done"
        job["result"] = result
        log(f"Training complete — accuracy={best_acc:.4f}")

    except Exception as e:
        job["status"] = "error"
        job["error"]  = str(e)
        log(f"Error: {e}")


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/status")
def status():
    return {
        "status":       "ok",
        "version":      "0.1.0",
        "uptimeSeconds": round(time.time() - _started_at, 1),
    }


@app.get("/bundles")
def list_bundles():
    return _list_bundles()


@app.get("/bundles/{bundle_id}")
def get_bundle_info(bundle_id: str):
    model_dir = MODELS_DIR / bundle_id
    meta_path = model_dir / "metadata.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail=f"Bundle '{bundle_id}' not found.")
    entry = {"bundleId": bundle_id, "backend": "onnx" if (model_dir / "model.onnx").exists() else "torch"}
    entry.update(json.loads(meta_path.read_text()))
    entry["loaded"] = bundle_id in _model_cache
    return entry


@app.post("/bundles/{bundle_id}/load")
def load_bundle(bundle_id: str):
    """Pre-warm the model cache for a bundle. Returns immediately if already loaded."""
    with _cache_lock:
        if bundle_id in _model_cache:
            return {"bundleId": bundle_id, "status": "already_loaded", "backend": _model_cache[bundle_id]["backend"]}
    entry = _get_bundle(bundle_id)  # raises HTTPException if not found
    return {"bundleId": bundle_id, "status": "loaded", "backend": entry["backend"]}


@app.post("/bundles/{bundle_id}/unload")
def unload_bundle(bundle_id: str):
    """Remove a bundle from the in-memory cache."""
    with _cache_lock:
        removed = _model_cache.pop(bundle_id, None)
    if removed is None:
        raise HTTPException(status_code=404, detail=f"Bundle '{bundle_id}' is not loaded.")
    return {"bundleId": bundle_id, "status": "unloaded"}


@app.post("/infer")
async def infer(request: Request):
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        form      = await request.form()
        bundle_id = str(form.get("bundleId") or "current")
        img_file  = form.get("image")
        img_b64   = form.get("imageBase64")

        if img_file is not None:
            raw = await img_file.read()
        elif img_b64:
            raw = base64.b64decode(str(img_b64).split(",")[-1])
        else:
            raise HTTPException(status_code=400, detail='Provide "image" file or "imageBase64" field.')
    else:
        body      = await request.json()
        bundle_id = str(body.get("bundleId") or "current")
        img_b64   = body.get("imageBase64") or body.get("image")

        if not img_b64:
            raise HTTPException(status_code=400, detail='Provide "imageBase64" (or "image") in JSON body.')

        raw = base64.b64decode(str(img_b64).split(",")[-1])

    return _run_infer(raw, bundle_id)


@app.post("/train")
async def start_train(request: Request):
    body = await request.json()

    dataset_id = body.get("datasetId") or body.get("dataset")
    if not dataset_id:
        raise HTTPException(status_code=400, detail='"datasetId" is required.')

    dataset_path = DATA_DIR / "datasets" / dataset_id
    if not dataset_path.is_dir():
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")

    bundle_id  = body.get("bundleId", "current")
    epochs     = int(body.get("epochs", 5))
    img_size   = int(body.get("imageSize", 224))
    batch_size = int(body.get("batchSize", 16))
    model_dir  = MODELS_DIR / bundle_id

    job_id = str(uuid.uuid4())
    job = {
        "id":         job_id,
        "status":     "queued",
        "datasetId":  dataset_id,
        "bundleId":   bundle_id,
        "logs":       [],
        "progress":   None,
        "result":     None,
        "error":      None,
        "stop":       False,
        "createdAt":  time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _jobs[job_id] = job

    config = {
        "datasetPath": str(dataset_path),
        "modelDir":    str(model_dir),
        "epochs":      epochs,
        "imageSize":   img_size,
        "batchSize":   batch_size,
    }
    t = threading.Thread(target=_run_training, args=(job_id, config), daemon=True)
    t.start()

    return {"id": job_id, "status": "queued", "bundleId": bundle_id, "datasetId": dataset_id}


@app.get("/train")
def list_train():
    return [
        {
            "id":        j["id"],
            "status":    j["status"],
            "datasetId": j["datasetId"],
            "bundleId":  j["bundleId"],
            "createdAt": j["createdAt"],
            "progress":  j["progress"],
        }
        for j in _jobs.values()
    ]


@app.get("/train/{job_id}")
def get_train(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return {
        "id":        job["id"],
        "status":    job["status"],
        "datasetId": job["datasetId"],
        "bundleId":  job["bundleId"],
        "createdAt": job["createdAt"],
        "progress":  job["progress"],
        "result":    job["result"],
        "error":     job["error"],
    }


@app.get("/train/{job_id}/logs")
def get_train_logs(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return {"id": job_id, "logs": job["logs"]}


@app.post("/train/{job_id}/stop")
def stop_train(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    job["stop"] = True
    return {"id": job_id, "status": "stop requested"}


# ── Entry ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7312))
    uvicorn.run("jumpsmarts:app", host="0.0.0.0", port=port, reload=False)
