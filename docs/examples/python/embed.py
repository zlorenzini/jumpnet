"""
examples/python/embed.py — generate a text embedding via JumpNet.
Usage:  python embed.py "round red bead"
"""
import sys, json, urllib.request

JUMPNET = "http://localhost:4080"

def embed(text: str, dimensions: int = 128) -> dict:
    payload = json.dumps({"text": text, "dimensions": dimensions}).encode()
    req = urllib.request.Request(
        f"{JUMPNET}/embed",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

if __name__ == "__main__":
    text = " ".join(sys.argv[1:]) or "round red bead"
    result = embed(text)
    print(f"Model:      {result['model']}")
    print(f"Dimensions: {result['dimensions']}")
    print(f"First 8:    {result['embedding'][:8]}")
