# clients/micropython/jumpnet.py
# JumpNet MicroPython client
# Compatible with MicroPython 1.20+ (ESP32, Pico W, etc.)
# Uses urequests (install via upip: import upip; upip.install('urequests'))
# For multipart uploads, raw socket approach is used to stay within RAM limits.

import ujson
import ubinascii

try:
    import urequests as requests
except ImportError:
    import requests  # CPython fallback


class JumpNetClient:
    def __init__(self, base_url="http://192.168.1.100:4080"):
        self.base_url = base_url.rstrip("/")

    def _url(self, path):
        return self.base_url + path

    # ── status ────────────────────────────────────────────────────────────────
    def status(self):
        r = requests.get(self._url("/status"))
        return ujson.loads(r.content)

    # ── infer (base64 JSON) ───────────────────────────────────────────────────
    def infer(self, image_bytes, bundle_id=None):
        """
        `image_bytes` — raw bytes from a JPEG (e.g. camera.capture()).
        Encodes as base64 and posts JSON. No multipart to keep RAM usage low.
        """
        b64 = ubinascii.b2a_base64(image_bytes).decode().rstrip("\n")
        payload = {"image": b64}
        if bundle_id:
            payload["bundleId"] = bundle_id
        body = ujson.dumps(payload)
        r = requests.post(
            self._url("/infer"),
            headers={"Content-Type": "application/json"},
            data=body,
        )
        return ujson.loads(r.content)

    # ── embed ─────────────────────────────────────────────────────────────────
    def embed(self, text, dimensions=64):
        body = ujson.dumps({"text": text, "dimensions": dimensions})
        r = requests.post(
            self._url("/embed"),
            headers={"Content-Type": "application/json"},
            data=body,
        )
        return ujson.loads(r.content)

    # ── dataset list ──────────────────────────────────────────────────────────
    def dataset_list(self):
        r = requests.get(self._url("/dataset/list"))
        return ujson.loads(r.content)

    # ── imprint (start training job) ─────────────────────────────────────────
    def imprint_start(self, dataset, epochs=5, learning_rate=0.001):
        body = ujson.dumps({"dataset": dataset, "epochs": epochs, "learningRate": learning_rate})
        r = requests.post(
            self._url("/imprint"),
            headers={"Content-Type": "application/json"},
            data=body,
        )
        return ujson.loads(r.content)

    def imprint_status(self, job_id):
        r = requests.get(self._url("/imprint/" + job_id))
        return ujson.loads(r.content)
