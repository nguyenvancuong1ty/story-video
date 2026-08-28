#!/usr/bin/env python3
"""Render an approved Second Act run through OpenMontage's FFmpeg runtime."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


def load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--plan", default="second-act-openmontage-plan.json")
    parser.add_argument("--openmontage", required=True)
    parser.add_argument("--output", default="second-act-openmontage.mp4")
    parser.add_argument("--draft-seconds", type=float, default=0)
    parser.add_argument("--comfy-root", default=r"C:\App\ComfyUI")
    return parser.parse_args()


def clip_index(retrieval: dict[str, Any]) -> dict[str, dict[str, Any]]:
    clips = ((retrieval.get("data") or {}).get("clips") or [])
    index: dict[str, dict[str, Any]] = {}
    for clip in clips:
        clip_id = str(clip.get("clip_id") or "")
        path = clip.get("path")
        if clip_id and path and clip_id not in index:
            index[clip_id] = clip
    return index


def stable_unit(value: str) -> float:
    digest = hashlib.sha256(value.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / float(2**64 - 1)


def srt_time(seconds: float) -> str:
    total_ms = max(0, round(seconds * 1000))
    hours, rem = divmod(total_ms, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, millis = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def caption_chunks(text: str, max_words: int = 9) -> list[str]:
    words = text.strip().split()
    return [" ".join(words[i:i + max_words]) for i in range(0, len(words), max_words)]


def write_subtitles(story: dict[str, Any], edit_plan: dict[str, Any], path: Path) -> None:
    story_beats = {beat["id"]: beat for beat in story.get("beats", [])}
    fps = float(edit_plan.get("fps", 30))
    entries: list[tuple[float, float, str]] = []
    for beat in edit_plan.get("beats", []):
        source = story_beats.get(beat.get("id"))
        if not source:
            continue
        start = float(beat["from"]) / fps
        duration = float(beat["durationInFrames"]) / fps
        chunks = caption_chunks(str(source.get("narration") or ""))
        weights = [max(1, len(chunk.split())) for chunk in chunks]
        total_weight = max(1, sum(weights))
        cursor = start
        for index, (chunk, weight) in enumerate(zip(chunks, weights)):
            end = start + duration if index == len(chunks) - 1 else cursor + duration * weight / total_weight
            entries.append((cursor, end, chunk))
            cursor = end
    blocks = []
    for index, (start, end, text) in enumerate(entries, 1):
        blocks.append(f"{index}\n{srt_time(start)} --> {srt_time(end)}\n{text}\n")
    path.write_text("\n".join(blocks), encoding="utf-8")


def media_duration_seconds(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    )
    return float(result.stdout.strip())



def resolve_plan_path(value: str, run_dir: Path) -> Path:
    path = Path(str(value))
    return path.resolve() if path.is_absolute() else (run_dir / path).resolve()


def materialize_ai_clips(plan: dict[str, Any], run_dir: Path, comfy_root: Path, clips: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    provider = Path(__file__).with_name("ltx-comfy-provider.py")
    for beat in plan.get("beats", []):
        for entry in list(beat.get("clips") or []):
            if not isinstance(entry, dict) or entry.get("type") != "ai_generate":
                continue
            clip_id = str(entry.get("id") or "").strip()
            prompt = str(entry.get("prompt") or "").strip()
            reference = resolve_plan_path(str(entry.get("reference") or ""), run_dir)
            if not clip_id or not prompt or not reference.exists():
                raise ValueError(f"Invalid ai_generate entry in {beat.get('id')}: id, prompt and reference are required")
            output = resolve_plan_path(str(entry.get("output") or f"ai/{clip_id}.mp4"), run_dir)
            output.parent.mkdir(parents=True, exist_ok=True)
            if not output.exists():
                cmd = [sys.executable, str(provider), "--comfy-root", str(comfy_root), "--reference", str(reference), "--prompt", prompt, "--output", str(output), "--seed", str(int(entry.get("seed", 65001))), "--seconds", str(float(entry.get("duration", 5.0))), "--width", str(int(entry.get("width", 768))), "--height", str(int(entry.get("height", 448))), "--start-strength", str(float(entry.get("start_strength", 2.0))), "--end-strength", str(float(entry.get("end_strength", 1.25)))]
                subprocess.run(cmd, check=True)
            clips[clip_id] = {
                "clip_id": clip_id,
                "path": str(output),
                "duration": media_duration_seconds(output),
                "source": "ltx-comfy",
                "source_url": None,
                "license": "generated",
            }
    return clips


def retime_edit_plan(edit_plan: dict[str, Any], run_dir: Path) -> dict[str, Any]:
    timed = json.loads(json.dumps(edit_plan))
    fps = float(timed.get("fps", 30))
    cursor = 0
    for beat in timed.get("beats", []):
        audio_path = run_dir / "audio" / f"{beat['id']}.mp3"
        if not audio_path.exists():
            raise FileNotFoundError(f"Missing narration audio: {audio_path}")
        duration_frames = max(1, math.ceil(media_duration_seconds(audio_path) * fps))
        beat["from"] = cursor
        beat["durationInFrames"] = duration_frames
        cursor += duration_frames
    timed["durationInFrames"] = cursor
    return timed


def normalize_beat_audio(sources: list[Path], output_audio: Path) -> None:
    if not sources or any(not source.exists() for source in sources):
        raise FileNotFoundError("One or more beat narration files are missing")
    concat_list = output_audio.with_suffix(".concat.txt")
    lines = []
    for source in sources:
        safe = str(source.resolve()).replace("\\", "/")
        lines.append(f"file '{safe}'")
    concat_list.write_text("\n".join(lines) + "\n", encoding="utf-8")
    try:
        analysis_cmd = [
            "ffmpeg", "-hide_banner", "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-af", "loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-",
        ]
        analysis = subprocess.run(analysis_cmd, check=True, capture_output=True, text=True)
        match = re.search(r"\{\s*\"input_i\".*?\}", analysis.stderr, re.S)
        if not match:
            raise RuntimeError("Could not parse FFmpeg loudnorm analysis")
        measured = json.loads(match.group(0))
        loudnorm = (
            "loudnorm=I=-14:TP=-1.5:LRA=7"
            f":measured_I={measured['input_i']}"
            f":measured_TP={measured['input_tp']}"
            f":measured_LRA={measured['input_lra']}"
            f":measured_thresh={measured['input_thresh']}"
            f":offset={measured['target_offset']}:linear=true:print_format=summary"
        )
        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-af", loudnorm,
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", str(output_audio),
        ]
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    finally:
        concat_list.unlink(missing_ok=True)


def build_cuts(
    plan: dict[str, Any], edit_plan: dict[str, Any], clips: dict[str, dict[str, Any]], draft_seconds: float
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], float]:
    planned = {beat["id"]: beat for beat in plan.get("beats", [])}
    fps = float(edit_plan.get("fps", 30))
    cuts: list[dict[str, Any]] = []
    assets: dict[str, dict[str, Any]] = {}
    timeline = 0.0
    for beat in edit_plan.get("beats", []):
        beat_id = str(beat.get("id"))
        if beat_id not in planned:
            raise ValueError(f"Plan is missing {beat_id}")
        beat_duration = float(beat["durationInFrames"]) / fps
        clip_ids = list(planned[beat_id].get("clips") or [])
        if not clip_ids:
            raise ValueError(f"Plan has no clips for {beat_id}")
        per_shot = beat_duration / len(clip_ids)
        for shot_index, clip_ref in enumerate(clip_ids):
            clip_id = str(clip_ref.get("id") if isinstance(clip_ref, dict) else clip_ref)
            if draft_seconds > 0 and timeline >= draft_seconds:
                return cuts, list(assets.values()), timeline
            clip = clips.get(str(clip_id))
            if not clip:
                raise ValueError(f"Clip not found in retrieval result: {clip_id}")
            source_duration = float(clip.get("duration") or 0)
            target = min(per_shot, max(0.1, draft_seconds - timeline)) if draft_seconds > 0 else per_shot
            available = max(0.2, source_duration - 0.15)
            if available >= target:
                speed = 1.0
                source_length = target
            else:
                speed = max(0.82, available / target)
                source_length = min(available, target * speed)
            max_start = max(0.0, source_duration - source_length - 0.1)
            source_start = max_start * stable_unit(f"{beat_id}:{shot_index}:{clip_id}")
            asset_id = f"asset-{clip_id}"
            assets[asset_id] = {
                "id": asset_id,
                "type": "video",
                "path": str(Path(clip["path"]).resolve()),
                "source": clip.get("source"),
                "source_url": clip.get("source_url"),
                "license": clip.get("license"),
            }
            cuts.append({
                "id": f"{beat_id}-shot-{shot_index + 1}",
                "type": "broll",
                "source": asset_id,
                "in_seconds": round(source_start, 3),
                "out_seconds": round(source_start + source_length, 3),
                "speed": round(speed, 4),
                "reason": f"Second Act continuity-safe visual for {beat_id}",
                "transition_in": "cut",
                "transition_out": "cut",
            })
            timeline += target
    return cuts, list(assets.values()), timeline


def find_source_video(run_dir: Path) -> Path:
    package_path = run_dir / "publishing-package.json"
    if package_path.exists():
        package = load_json(package_path)
        candidate = Path(str(package.get("video") or ""))
        if candidate.exists():
            return candidate
    candidates = [p for p in run_dir.glob("*.mp4") if "openmontage" not in p.name.lower()]
    if not candidates:
        raise FileNotFoundError("No existing rendered MP4 found to reuse narration audio")
    return max(candidates, key=lambda path: path.stat().st_size)


def main() -> int:
    args = parse_args()
    run_dir = Path(args.run_dir).resolve()
    openmontage = Path(args.openmontage).resolve()
    if not run_dir.is_dir() or not openmontage.is_dir():
        raise FileNotFoundError("run-dir or OpenMontage checkout does not exist")
    story = load_json(run_dir / "story.json")
    edit_plan = retime_edit_plan(load_json(run_dir / "edit-plan.json"), run_dir)
    retrieval = load_json(run_dir / "openmontage-result.json")
    plan_path = Path(args.plan)
    if not plan_path.is_absolute():
        plan_path = run_dir / plan_path
    plan = load_json(plan_path)
    clips = clip_index(retrieval)
    clips = materialize_ai_clips(plan, run_dir, Path(args.comfy_root).resolve(), clips)
    cuts, assets, total_duration = build_cuts(plan, edit_plan, clips, args.draft_seconds)
    subtitle_path = run_dir / "second-act-openmontage.srt"
    write_subtitles(story, edit_plan, subtitle_path)

    audio_files = [run_dir / "audio" / f"{beat['id']}.mp3" for beat in story.get("beats", [])]
    normalized_audio = run_dir / "second-act-openmontage-audio.m4a"
    normalize_beat_audio(audio_files, normalized_audio)
    (run_dir / "second-act-openmontage-timed-edit-plan.json").write_text(
        json.dumps(edit_plan, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = run_dir / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    edit_decisions = {
        "version": "1.0",
        "render_runtime": "ffmpeg",
        "renderer_family": "documentary-montage",
        "total_duration_seconds": round(total_duration, 3),
        "metadata": {
            "compose_target": {"width": 1920, "height": 1080, "fit": "cover"},
            "proposal_render_runtime": "ffmpeg",
            "visual_direction": "second-act-visual-direction",
        },
        "subtitles": {
            "enabled": True,
            "source": str(subtitle_path),
            "style": {
                "font": "Arial",
                "font_size": 20,
                "bold": True,
                "primary_color": "&H00FFFFFF",
                "outline_color": "&H00000000",
                "outline_width": 2,
                "shadow": 0,
                "margin_v": 42,
                "alignment": 2,
            },
        },
        "cuts": cuts,
    }
    asset_manifest = {"version": "1.0", "assets": assets}
    (run_dir / "second-act-openmontage-edit-decisions.json").write_text(
        json.dumps(edit_decisions, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (run_dir / "second-act-openmontage-asset-manifest.json").write_text(
        json.dumps(asset_manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    sys.path.insert(0, str(openmontage))
    from tools.video.video_compose import VideoCompose

    result = VideoCompose().execute({
        "operation": "render",
        "edit_decisions": edit_decisions,
        "asset_manifest": asset_manifest,
        "output_path": str(output_path),
        "audio_path": str(normalized_audio),
        "subtitle_path": str(subtitle_path),
        "codec": "libx264",
        "crf": 24 if args.draft_seconds > 0 else 20,
        "preset": "ultrafast" if args.draft_seconds > 0 else "veryfast",
        "subtitle_style": edit_decisions["subtitles"]["style"],
        "script_text": " ".join(str(beat.get("narration") or "") for beat in story.get("beats", [])),
    })
    report = {
        "success": result.success,
        "error": result.error,
        "data": result.data,
        "output": str(output_path),
        "cut_count": len(cuts),
        "total_duration_seconds": round(total_duration, 3),
    }
    (run_dir / "second-act-openmontage-render-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, default=str))
    return 0 if result.success else 1


if __name__ == "__main__":
    raise SystemExit(main())
