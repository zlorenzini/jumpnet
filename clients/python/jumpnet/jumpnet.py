"""
clients/python/jumpnet/jumpnet.py
JumpNet Python client — zero dependencies (stdlib only).
"""
from __future__ import annotations
import json, base64, urllib.request, urllib.error
from pathlib import Path
from typing import Any


class JumpNetError(RuntimeError):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status}: {body}")
        self.status = status


class JumpNetClient:
    """Minimal Python client for the JumpNet API."""

    def __init__(self, base_url: str = "http://localhost:4080"):
        self.base_url = base_url.rstrip("/")

    # ── helpers ───────────────────────────────────────────────────────────────
    def _request(self, method: str, path: str, *, data: bytes | None = None,
                 content_type: str = "application/json") -> Any:
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            headers={"Content-Type": content_type} if data else {},
            method=method,
        )
        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            raise JumpNetError(e.code, e.read().decode()) from e

    def _json(self, method: str, path: str, payload: Any | None = None) -> Any:
        data = json.dumps(payload).encode() if payload is not None else None
        return self._request(method, path, data=data)

    # ── status ────────────────────────────────────────────────────────────────
    def status(self) -> dict:
        return self._json("GET", "/status")

    # ── infer ─────────────────────────────────────────────────────────────────
    def infer(self, image: bytes | str | Path, *, bundle_id: str | None = None) -> dict:
        if isinstance(image, Path):
            image = image.read_bytes()
        if isinstance(image, bytes):
            image = base64.b64encode(image).decode()
        payload: dict[str, Any] = {"image": image}
        if bundle_id:
            payload["bundleId"] = bundle_id
        return self._json("POST", "/infer", payload)

    # ── embed ─────────────────────────────────────────────────────────────────
    def embed(self, text: str, *, model: str | None = None, dimensions: int = 128) -> dict:
        payload: dict[str, Any] = {"text": text, "dimensions": dimensions}
        if model:
            payload["model"] = model
        return self._json("POST", "/embed", payload)

    # ── dataset ───────────────────────────────────────────────────────────────
    def dataset_list(self) -> list:
        return self._json("GET", "/dataset/list")

    def dataset_info(self, name: str) -> dict:
        return self._json("GET", f"/dataset/{name}")

    def dataset_upload(self, image: bytes | Path, *, dataset: str, label: str) -> dict:
        if isinstance(image, Path):
            filename = image.name
            image = image.read_bytes()
        else:
            filename = "image.jpg"
        boundary = b"----JumpNetPyBoundary123"
        CRLF = b"\r\n"

        def field(name: str, value: str) -> bytes:
            return (b"--" + boundary + CRLF +
                    f'Content-Disposition: form-data; name="{name}"'.encode() + CRLF + CRLF +
                    value.encode() + CRLF)

        file_part = (
            b"--" + boundary + CRLF +
            f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode() + CRLF +
            b"Content-Type: image/jpeg" + CRLF + CRLF +
            image + CRLF
        )
        body = field("dataset", dataset) + field("label", label) + file_part + b"--" + boundary + b"--" + CRLF
        return self._request("POST", "/dataset/upload", data=body,
                             content_type=f"multipart/form-data; boundary={boundary.decode()}")

    def dataset_delete(self, dataset: str, label: str, filename: str) -> None:
        self._json("DELETE", f"/dataset/{dataset}/{label}/{filename}")

    # ── compose ───────────────────────────────────────────────────────────────
    def compose(self, image: bytes | str | Path, pipeline: list[dict]) -> dict:
        if isinstance(image, Path):
            image = image.read_bytes()
        if isinstance(image, bytes):
            image = base64.b64encode(image).decode()
        return self._json("POST", "/compose", {"image": image, "pipeline": pipeline})

    # ── imprint ───────────────────────────────────────────────────────────────
    def imprint_start(self, dataset: str, *, epochs: int = 10, learning_rate: float = 0.001) -> dict:
        return self._json("POST", "/imprint", {"dataset": dataset, "epochs": epochs, "learningRate": learning_rate})

    def imprint_list(self) -> list:
        return self._json("GET", "/imprint")

    def imprint_status(self, job_id: str) -> dict:
        return self._json("GET", f"/imprint/{job_id}")

    def imprint_logs(self, job_id: str) -> dict:
        return self._json("GET", f"/imprint/{job_id}/logs")

    def imprint_stop(self, job_id: str) -> dict:
        return self._json("POST", f"/imprint/{job_id}/stop")
