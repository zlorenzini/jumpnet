"""
examples/python/infer.py — run image classification via JumpNet.
Usage:  python infer.py <image_path> [bundle_id]
"""
import sys, base64, json, urllib.request

JUMPNET = "http://localhost:4080"

def infer(image_path: str, bundle_id: str | None = None) -> dict:
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    payload = {"image": b64}
    if bundle_id:
        payload["bundleId"] = bundle_id

    data = json.dumps(payload).encode()
    req  = urllib.request.Request(
        f"{JUMPNET}/infer",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python infer.py <image_path> [bundle_id]")
        sys.exit(1)
    result = infer(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print(json.dumps(result, indent=2))
