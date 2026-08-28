#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import time
import urllib.request
from pathlib import Path
from typing import Any


def http_json(url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate a Second Act LTX I2V shot through ComfyUI")
    p.add_argument("--comfy-root", default=r"C:\App\ComfyUI")
    p.add_argument("--comfy-url", default="http://127.0.0.1:8188")
    p.add_argument("--reference", required=True)
    p.add_argument("--prompt", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--negative", default="different person, young woman, changed face, changed hair, extra person, duplicate person, deformed hands, extra fingers, morphing, jitter, plastic skin, text, logo")
    p.add_argument("--seed", type=int, default=65001)
    p.add_argument("--seconds", type=float, default=5.0)
    p.add_argument("--fps", type=float, default=24.0)
    p.add_argument("--width", type=int, default=768)
    p.add_argument("--height", type=int, default=448)
    p.add_argument("--steps", type=int, default=20)
    p.add_argument("--start-strength", type=float, default=2.0)
    p.add_argument("--end-strength", type=float, default=1.25)
    p.add_argument("--keep-frames", action="store_true")
    return p.parse_args()


def valid_ltx_length(seconds: float, fps: float) -> int:
    target = max(9, round(seconds * fps) + 1)
    return ((target - 1 + 7) // 8) * 8 + 1


def build_workflow(args: argparse.Namespace, ref_name: str, prefix: str, length: int) -> dict[str, Any]:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "ltxv-2b-0.9.8-distilled.safetensors"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "t5xxl_bf16_pixart.safetensors", "type": "ltxv", "device": "default"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": args.prompt, "clip": ["2", 0]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": args.negative, "clip": ["2", 0]}},
        "5": {"class_type": "LTXVConditioning", "inputs": {"positive": ["3", 0], "negative": ["4", 0], "frame_rate": args.fps}},
        "6": {"class_type": "LoadImage", "inputs": {"image": ref_name}},
        "7": {"class_type": "EmptyLTXVLatentVideo", "inputs": {"width": args.width, "height": args.height, "length": length, "batch_size": 1}},
        "8": {"class_type": "LTXVAddGuide", "inputs": {"positive": ["5", 0], "negative": ["5", 1], "vae": ["1", 2], "latent": ["7", 0], "image": ["6", 0], "frame_idx": 0, "strength": args.start_strength}},
        "9": {"class_type": "LTXVAddGuide", "inputs": {"positive": ["8", 0], "negative": ["8", 1], "vae": ["1", 2], "latent": ["8", 2], "image": ["6", 0], "frame_idx": -1, "strength": args.end_strength}},
        "10": {"class_type": "LTXVScheduler", "inputs": {"steps": args.steps, "max_shift": 2.05, "base_shift": 0.95, "stretch": True, "terminal": 0.1, "latent": ["9", 2]}},
        "11": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
        "12": {"class_type": "SamplerCustom", "inputs": {"model": ["1", 0], "add_noise": True, "noise_seed": args.seed, "cfg": 1.0, "positive": ["9", 0], "negative": ["9", 1], "sampler": ["11", 0], "sigmas": ["10", 0], "latent_image": ["9", 2]}},
        "13": {"class_type": "LTXVCropGuides", "inputs": {"positive": ["9", 0], "negative": ["9", 1], "latent": ["12", 0]}},
        "14": {"class_type": "VAEDecode", "inputs": {"samples": ["13", 2], "vae": ["1", 2]}},
        "15": {"class_type": "SaveImage", "inputs": {"images": ["14", 0], "filename_prefix": prefix}},
    }


def wait_for_prompt(base: str, prompt_id: str) -> dict[str, Any]:
    for _ in range(900):
        history = http_json(f"{base}/history/{prompt_id}")
        if prompt_id in history:
            item = history[prompt_id]
            status = item.get("status", {})
            if status.get("status_str") != "success":
                raise RuntimeError(json.dumps(status, ensure_ascii=False))
            return item
        time.sleep(1)
    raise TimeoutError("ComfyUI generation timed out")

def main() -> int:
    args = parse_args()
    comfy_root = Path(args.comfy_root).resolve()
    reference = Path(args.reference).resolve()
    output = Path(args.output).resolve()
    if not reference.exists():
        raise FileNotFoundError(reference)
    http_json(f"{args.comfy_url}/system_stats")
    length = valid_ltx_length(args.seconds, args.fps)
    token = hashlib.sha1(f"{output}|{args.seed}|{time.time_ns()}".encode()).hexdigest()[:12]
    ref_name = f"story_video_ref_{token}{reference.suffix.lower()}"
    ref_copy = comfy_root / "input" / ref_name
    prefix = f"story_video_ai/{token}/frame"
    frame_dir = comfy_root / "output" / "story_video_ai" / token
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(reference, ref_copy)
    started = time.time()
    try:
        queued = http_json(f"{args.comfy_url}/prompt", {"prompt": build_workflow(args, ref_name, prefix, length), "client_id": f"story-video-{token}"})
        prompt_id = str(queued["prompt_id"])
        item = wait_for_prompt(args.comfy_url, prompt_id)
        images = ((item.get("outputs") or {}).get("15") or {}).get("images") or []
        if len(images) != length:
            raise RuntimeError(f"Expected {length} frames after guide crop, got {len(images)}")
        pattern = frame_dir / "frame_%05d_.png"
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(args.fps), "-i", str(pattern), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", str(output)]
        subprocess.run(cmd, check=True)
        probe = subprocess.run([
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height,r_frame_rate", "-show_entries", "format=duration,size",
            "-of", "json", str(output)
        ], check=True, capture_output=True, text=True)
        report = {
            "success": True,
            "output": str(output),
            "prompt_id": prompt_id,
            "frames": len(images),
            "generation_seconds": round(time.time() - started, 2),
            "probe": json.loads(probe.stdout),
        }
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    finally:
        ref_copy.unlink(missing_ok=True)
        if not args.keep_frames and frame_dir.exists():
            shutil.rmtree(frame_dir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
