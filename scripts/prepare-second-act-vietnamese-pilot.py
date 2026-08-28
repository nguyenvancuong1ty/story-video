#!/usr/bin/env python3
"""Create a Vietnamese, continuity-safe Second Act pilot run from an English source run."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import urllib.request
import urllib.error
from pathlib import Path


REPLACEMENTS = {
    "pexels_6248296": "pexels_7735809",  # clear-face alternate woman -> budget detail
    "pexels_7655577": "pexels_36378027",  # clear-face older man -> balcony silhouette
    "pexels_8439247": "pexels_35611172",  # clear-face couple -> diner exterior
    "pexels_8439245": "pexels_7055354",  # male hands signing -> neutral insurance paperwork
    "pexels_6248325": "pexels_5214749",  # clear-face alternate woman -> plants detail
}
ROLE_FIXES = {"pexels_6031868": "silhouette", "pexels_8347236": "environment", "pexels_36378027": "silhouette"}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def post_json(url: str, payload: dict, api_key: str | None = None) -> dict:
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST")
    request.add_header("content-type", "application/json")
    if api_key:
        request.add_header("authorization", f"Bearer {api_key}")
    with urllib.request.urlopen(request, timeout=180) as response:
        raw = response.read().decode()
    if not raw.lstrip().startswith("data:"):
        return json.loads(raw)
    content = ""
    for line in raw.splitlines():
        if not line.startswith("data:"):
            continue
        item = line[5:].strip()
        if not item or item == "[DONE]":
            continue
        payload = json.loads(item)
        choice = (payload.get("choices") or [{}])[0]
        content += (choice.get("delta") or choice.get("message") or {}).get("content") or ""
    return {"choices": [{"message": {"content": content}}]}


def translate_story(story: dict, base_url: str, model: str, api_key: str | None) -> dict:
    instruction = """Translate this fictional US Second Act story into natural, mature Vietnamese for voice narration. Preserve every beat id, visualQueries, visualTone, ambience, and the story's US setting/details. Translate title, description, audiencePromise, fictionDisclosure, narration, subtitle, and keyPhrase only. Keep the same JSON shape. Do not add advice or new facts. Return JSON only."""
    response = post_json(base_url.rstrip("/") + "/chat/completions", {
        "model": model,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": instruction}, {"role": "user", "content": json.dumps(story, ensure_ascii=False)}],
    }, api_key)
    content = response["choices"][0]["message"]["content"].strip().removeprefix("```json").removesuffix("```").strip()
    translated = json.loads(content)
    if [x["id"] for x in translated.get("beats", [])] != [x["id"] for x in story["beats"]]:
        raise ValueError("Vietnamese translation did not preserve beat ids")
    return translated


def synthesize(text: str, base_url: str, voice_index: int, rate: str) -> bytes:
    request = urllib.request.Request(base_url.rstrip("/") + "/api/tts/raw", data=json.dumps({"text": text, "voice_index": voice_index, "rate": rate}).encode(), method="POST")
    request.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            audio = response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace").replace("\n", " ")[:500]
        raise RuntimeError(f"CapCut TTS failed ({error.code}): {detail}") from error
    if not audio:
        raise ValueError("CapCut TTS returned empty audio")
    return audio


def synthesize_beat(text: str, target: Path, base_url: str, voice_index: int, rate: str) -> None:
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
    if len(sentences) == 1:
        target.write_bytes(synthesize(text, base_url, voice_index, rate))
        return
    parts = []
    for index, sentence in enumerate(sentences):
        part = target.with_name(f"{target.stem}.part-{index:02d}.mp3")
        part.write_bytes(synthesize(sentence, base_url, voice_index, rate))
        parts.append(part)
    manifest = target.with_suffix(".concat.txt")
    manifest.write_text("".join(f"file '{part.resolve().as_posix()}'\n" for part in parts), encoding="utf-8")
    try:
        subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(manifest), "-c", "copy", str(target)], check=True, capture_output=True)
    finally:
        manifest.unlink(missing_ok=True)
        for part in parts:
            part.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-run", required=True)
    parser.add_argument("--output-run", required=True)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--voice-index", type=int, default=0)
    args = parser.parse_args()
    source, output, plan_path = Path(args.source_run).resolve(), Path(args.output_run).resolve(), Path(args.plan).resolve()
    output.mkdir(parents=True, exist_ok=True)
    story = load(source / "story.json")
    translated = translate_story(story, os.environ.get("LOCAL_LLM_BASE_URL", "http://localhost:20128/v1"), os.environ.get("LOCAL_LLM_MODEL", "cx/gpt-5.6-terra"), os.environ.get("LOCAL_GATEWAY_API_KEY") or None)
    (output / "audio").mkdir(exist_ok=True)
    (output / "story.json").write_text(json.dumps(translated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.copy2(source / "edit-plan.json", output / "edit-plan.json")
    shutil.copy2(source / "openmontage-result.json", output / "openmontage-result.json")
    plan = load(plan_path)
    for beat in plan["beats"]:
        for clip in beat["clips"]:
            if not isinstance(clip, dict):
                continue
            clip["id"] = REPLACEMENTS.get(clip["id"], clip["id"])
            if clip["id"] in ROLE_FIXES:
                clip["role"] = ROLE_FIXES[clip["id"]]
            if clip.get("type") == "ai_generate":
                clip["reference"] = str((source / clip["reference"]).resolve())
                clip["output"] = str((source / clip["output"]).resolve())
    (output / "semantic-plan.v2.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tts_url = os.environ.get("CAPCUT_TTS_BASE_URL", "http://127.0.0.1:8765")
    rate = os.environ.get("CAPCUT_TTS_RATE", "1.0")
    for beat in translated["beats"]:
        target = output / "audio" / f"{beat['id']}.mp3"
        if target.exists() and target.stat().st_size > 1024:
            continue
        synthesize_beat(beat["narration"], target, tts_url, args.voice_index, rate)
    (output / "vi-pilot-metadata.json").write_text(json.dumps({"language": "vi-VN", "voice_index": args.voice_index, "voice_name": "BV421_vivn_streaming", "source_run": str(source), "replaced_assets": REPLACEMENTS}, indent=2) + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
