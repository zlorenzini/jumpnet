"""
examples/python/dataset.py — upload an image to a JumpNet dataset.
Usage:  python dataset.py <image_path> <dataset_name> <label>
"""
import sys, urllib.request

JUMPNET = "http://localhost:4080"

def upload(image_path: str, dataset: str, label: str) -> str:
    boundary = b"----JumpNetPyBoundary"
    CRLF = b"\r\n"

    def field(name: str, value: str) -> bytes:
        return (
            b"--" + boundary + CRLF +
            f'Content-Disposition: form-data; name="{name}"'.encode() + CRLF + CRLF +
            value.encode() + CRLF
        )

    with open(image_path, "rb") as f:
        img_data = f.read()

    filename = image_path.split("/")[-1].split("\\")[-1]
    file_part = (
        b"--" + boundary + CRLF +
        f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode() + CRLF +
        b"Content-Type: image/jpeg" + CRLF + CRLF +
        img_data + CRLF
    )
    body = field("dataset", dataset) + field("label", label) + file_part + b"--" + boundary + b"--" + CRLF

    req = urllib.request.Request(
        f"{JUMPNET}/dataset/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary.decode()}"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode()

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python dataset.py <image_path> <dataset_name> <label>")
        sys.exit(1)
    print(upload(sys.argv[1], sys.argv[2], sys.argv[3]))
