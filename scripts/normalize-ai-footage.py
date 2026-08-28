#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


def probe(path: Path) -> dict:
    result = subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,pix_fmt",
        "-show_entries", "format=duration,size", "-of", "json", str(path)
    ], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def main() -> int:
    p = argparse.ArgumentParser(description="Normalize local AI footage before OpenMontage composition")
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--width", type=int, default=1920)
    p.add_argument("--height", type=int, default=1080)
    p.add_argument("--crf", type=int, default=18)
    p.add_argument("--grain", type=float, default=1.4)
    args = p.parse_args()

    src = Path(args.input).resolve()
    dst = Path(args.output).resolve()
    if not src.exists():
        raise FileNotFoundError(src)
    dst.parent.mkdir(parents=True, exist_ok=True)

    # Keep the treatment restrained: high-quality Lanczos upscale/crop, a small
    # amount of sharpening, and subtle temporal grain to reduce the waxy AI look.
    vf = (
        f"scale={args.width}:{args.height}:force_original_aspect_ratio=increase:flags=lanczos,"
        f"crop={args.width}:{args.height},"
        "unsharp=5:5:0.22:3:3:0.0,"
        f"noise=alls={args.grain}:allf=t+u,"
        "format=yuv420p"
    )
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
        "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast",
        "-crf", str(args.crf), "-movflags", "+faststart", str(dst)
    ], check=True)

    print(json.dumps({"success": True, "input": str(src), "output": str(dst), "probe": probe(dst)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
