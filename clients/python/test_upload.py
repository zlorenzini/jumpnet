#!/usr/bin/env python3
"""
clients/python/test_upload.py

Sends a labeled image to POST /dataset/upload and prints the server response.

Usage:
    python test_upload.py                          # uses built-in test image (base64 JSON)
    python test_upload.py path/to/image.jpg        # uploads a real file (multipart)

Environment variables:
    JUMPNET_URL   default http://localhost:4080
    DATASET       default test-dataset
    LABEL         default test-label
"""
import sys, os, json, base64, urllib.request, urllib.error

JUMPNET = os.environ.get("JUMPNET_URL", "http://localhost:4080").rstrip("/")
DATASET = os.environ.get("DATASET", "test-dataset")
LABEL   = os.environ.get("LABEL",   "test-label")

# Minimal 1×1 white JPEG — no external file needed for smoke-testing
TINY_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U"
    "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC"
    "AABAAEDAQIRAAQAAQIB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/"
    "xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k="
)


def upload_base64():
    payload = json.dumps({"dataset": DATASET, "label": LABEL, "image": TINY_JPEG_B64, "filename": "test.jpg"}).encode()
    req = urllib.request.Request(
        f"{JUMPNET}/dataset/upload",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return req


def upload_file(path: str):
    filename = os.path.basename(path)
    with open(path, "rb") as f:
        img_data = f.read()

    boundary = b"----JumpNetPyTestBoundary"
    CRLF = b"\r\n"

    def field(name: str, value: str) -> bytes:
        return (
            b"--" + boundary + CRLF
            + f'Content-Disposition: form-data; name="{name}"'.encode() + CRLF + CRLF
            + value.encode() + CRLF
        )

    file_part = (
        b"--" + boundary + CRLF
        + f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode() + CRLF
        + b"Content-Type: image/jpeg" + CRLF + CRLF
        + img_data + CRLF
    )
    body = field("dataset", DATASET) + field("label", LABEL) + file_part + b"--" + boundary + b"--" + CRLF

    req = urllib.request.Request(
        f"{JUMPNET}/dataset/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary.decode()}"},
        method="POST",
    )
    return req


def main():
    print(f"JumpNet : {JUMPNET}")
    print(f"Dataset : {DATASET}  /  Label: {LABEL}")

    img_path = sys.argv[1] if len(sys.argv) > 1 else None

    if img_path:
        if not os.path.isfile(img_path):
            print(f"File not found: {img_path}", file=sys.stderr)
            sys.exit(1)
        print(f"Uploading file : {img_path}")
        req = upload_file(img_path)
    else:
        print("No file provided — uploading built-in 1×1 test JPEG via JSON base64.")
        req = upload_base64()

    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            body   = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        status = e.code
        body   = json.loads(e.read())

    print(f"\nHTTP {status}")
    print(json.dumps(body, indent=2))

    sys.exit(0 if status < 400 else 1)


if __name__ == "__main__":
    main()
