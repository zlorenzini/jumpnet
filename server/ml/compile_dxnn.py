"""compile_dxnn.py — dx_com wrapper for JumpNet compile route.

Called by routes/compile.js as:
    python compile_dxnn.py <args_json_path>

args_json fields:
    onnx_path        str   — path to .onnx file
    output_dir       str   — directory to write .dxnn into
    model_name       str   — stem for output filename
    calibration_num  int   — synthetic calibration samples (default 20)
    input_shape      list  — e.g. [1, 1024, 128]  (auto-detected if null)
    input_name       str   — ONNX input tensor name (default "input_values")

Outputs a single JSON line to stdout:
    {"dxnn_path": "..."} on success
    {"error": "..."}     on failure
"""

import json
import os
import sys
from pathlib import Path


def _detect_input_shape(onnx_path: str):
    """Infer input shape from the ONNX model graph."""
    import onnx
    model   = onnx.load(onnx_path)
    inp     = model.graph.input[0]
    shape   = [d.dim_value for d in inp.type.tensor_type.shape.dim]
    return shape


def _build_dataloader(input_shape: list, calibration_num: int):
    """Create a synthetic float32 DataLoader for dx_com calibration."""
    import torch
    from torch.utils.data import Dataset, DataLoader
    import numpy as np

    # Drop the batch dimension (index 0) for per-sample shape
    sample_shape = tuple(input_shape[1:]) if input_shape[0] == 1 else tuple(input_shape)

    class SyntheticDataset(Dataset):
        def __len__(self):
            return calibration_num

        def __getitem__(self, _idx):
            # Gaussian noise mimics the statistics of a log-mel spectrogram
            return torch.from_numpy(np.random.randn(*sample_shape).astype("float32"))

    return DataLoader(SyntheticDataset(), batch_size=1, shuffle=False)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: compile_dxnn.py <args_json_path>"}))
        sys.exit(0)

    args_path = sys.argv[1]
    with open(args_path) as f:
        args = json.load(f)

    onnx_path       = args["onnx_path"]
    output_dir      = args["output_dir"]
    model_name      = args.get("model_name", "model")
    calibration_num = int(args.get("calibration_num", 20))
    input_shape     = args.get("input_shape")   # may be None → auto-detect

    os.makedirs(output_dir, exist_ok=True)

    try:
        import dx_com
    except ImportError as e:
        print(json.dumps({"error": f"dx_com not importable: {e}"}))
        sys.exit(0)

    try:
        # Auto-detect input shape if not provided
        if input_shape is None:
            input_shape = _detect_input_shape(onnx_path)

        dataloader = _build_dataloader(input_shape, calibration_num)

        dx_com.compile(
            model=onnx_path,
            output_dir=output_dir,
            dataloader=dataloader,
            calibration_method="ema",
            calibration_num=calibration_num,
            opt_level=1,
            aggressive_partitioning=True,   # maximise NPU ops; good for edge
            gen_log=True,
        )

        # Locate the produced .dxnn file
        dxnn_files = list(Path(output_dir).glob("*.dxnn"))
        if not dxnn_files:
            print(json.dumps({"error": "dx_com completed but no .dxnn found in output_dir"}))
            sys.exit(0)

        print(json.dumps({"dxnn_path": str(dxnn_files[0])}))

    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(0)


if __name__ == "__main__":
    main()
