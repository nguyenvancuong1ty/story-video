#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
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
    p = argparse.ArgumentParser(description="Generate an identity-preserving Second Act scene keyframe with native ComfyUI PhotoMaker")
    p.add_argument("--comfy-root", default=r"C:\App\ComfyUI")
    p.add_argument("--comfy-url", default="http://127.0.0.1:8188")
    p.add_argument("--reference", required=True)
    p.add_argument("--prompt", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--checkpoint", default="sd_xl_base_1.0.safetensors")
    p.add_argument("--photomaker", default="photomaker-v1.bin")
    p.add_argument("--negative", default="different person, young woman, man, extra person, duplicate person, changed hair, changed face, beauty filter, plastic skin, deformed hands, extra fingers, text, logo, watermark")
    p.add_argument("--seed", type=int, default=73001)
    p.add_argument("--width", type=int, default=1152)
    p.add_argument("--height", type=int, default=648)
    p.add_argument("--steps", type=int, default=24)
    p.add_argument("--cfg", type=float, default=4.5)
    return p.parse_args()


def build_workflow(args: argparse.Namespace, ref_name: str, prefix: str) -> dict[str, Any]:
    positive = "photograph of photomaker " + args.prompt.strip()
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": args.checkpoint}},
        "2": {"class_type": "PhotoMakerLoader", "inputs": {"photomaker_model_name": args.photomaker}},
        "3": {"class_type": "LoadImage", "inputs": {"image": ref_name}},
        "4": {"class_type": "PhotoMakerEncode", "inputs": {"photomaker": ["2", 0], "image": ["3", 0], "clip": ["1", 1], "text": positive}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"text": args.negative, "clip": ["1", 1]}},
        "6": {"class_type": "EmptyLatentImage", "inputs": {"width": args.width, "height": args.height, "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": args.seed, "steps": args.steps, "cfg": args.cfg, "sampler_name": "dpmpp_2m", "scheduler": "karras", "positive": ["4", 0], "negative": ["5", 0], "latent_image": ["6", 0], "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
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
    raise TimeoutError("ComfyUI PhotoMaker generation timed out")


def main() -> int:
    args = parse_args()
    comfy_root = Path(args.comfy_root).resolve()
    reference = Path(args.reference).resolve()
    output = Path(args.output).resolve()
    if not reference.exists():
        raise FileNotFoundError(reference)
    prompt_words = args.prompt.strip().split()
    if len(prompt_words) > 60:
        raise ValueError(
            f"PhotoMaker prompt is too long ({len(prompt_words)} words); keep it at 60 words or fewer "
            "so native SDXL conditioning stays within a single 77-token chunk."
        )
    http_json(f"{args.comfy_url}/system_stats")
    token = hashlib.sha1(f"{output}|{args.seed}|{time.time_ns()}".encode()).hexdigest()[:12]
    ref_name = f"story_video_pm_{token}{reference.suffix.lower()}"
    ref_copy = comfy_root / "input" / ref_name
    prefix = f"story_video_keyframes/{token}/keyframe"
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(reference, ref_copy)
    started = time.time()
    try:
        queued = http_json(f"{args.comfy_url}/prompt", {"prompt": build_workflow(args, ref_name, prefix), "client_id": f"story-video-pm-{token}"})
        prompt_id = str(queued["prompt_id"])
        item = wait_for_prompt(args.comfy_url, prompt_id)
        images = ((item.get("outputs") or {}).get("9") or {}).get("images") or []
        if not images:
            raise RuntimeError("PhotoMaker produced no image")
        meta = images[0]
        src = comfy_root / "output" / str(meta.get("subfolder") or "") / str(meta["filename"])
        if not src.exists():
            raise FileNotFoundError(src)
        shutil.copy2(src, output)
        report = {"success": True, "output": str(output), "prompt_id": prompt_id, "generation_seconds": round(time.time() - started, 2), "source": str(src)}
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    finally:
        ref_copy.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
