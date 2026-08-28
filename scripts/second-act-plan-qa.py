#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ALLOWED_ROLES = {"protagonist", "environment", "object", "hands", "silhouette", "supporting", "graphic"}


def load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return data


def validate(plan: dict[str, Any], strict: bool) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    contract = int(plan.get("semantic_contract_version") or 1)
    strict = strict or contract >= 2

    beats = plan.get("beats") or []
    if not isinstance(beats, list) or not beats:
        errors.append("plan.beats must be a non-empty array")
        return errors, warnings

    for beat in beats:
        beat_id = str((beat or {}).get("id") or "<unknown>")
        clips = (beat or {}).get("clips") or []
        if not clips:
            errors.append(f"{beat_id}: clips is empty")
            continue
        for idx, entry in enumerate(clips, 1):
            label = f"{beat_id} clip {idx}"
            if isinstance(entry, str):
                msg = f"{label}: legacy bare stock id '{entry}' has no semantic role"
                (errors if strict else warnings).append(msg)
                continue
            if not isinstance(entry, dict):
                errors.append(f"{label}: clip entry must be string or object")
                continue

            clip_type = str(entry.get("type") or "stock")
            clip_id = str(entry.get("id") or "").strip()
            role = str(entry.get("role") or "").strip()
            if not clip_id:
                errors.append(f"{label}: missing id")
            if strict and not role:
                errors.append(f"{label}: missing role")
            if role and role not in ALLOWED_ROLES:
                errors.append(f"{label}: unsupported role '{role}'")

            if clip_type == "stock":
                if role == "protagonist" and entry.get("continuity_approved") is not True:
                    errors.append(f"{label}: protagonist stock requires continuity_approved=true")
                if role in {"environment", "object", "hands", "silhouette"} and entry.get("continuity_approved") is True:
                    warnings.append(f"{label}: continuity_approved is unnecessary for role '{role}'")
            elif clip_type == "ai_generate":
                for field in ("reference", "prompt"):
                    if not str(entry.get(field) or "").strip():
                        errors.append(f"{label}: ai_generate missing {field}")
                if strict and role != "protagonist":
                    warnings.append(f"{label}: ai_generate normally uses role='protagonist'")
                identity_source = str(entry.get("identity_source") or "").strip()
                if strict and role == "protagonist" and not identity_source:
                    warnings.append(f"{label}: protagonist ai_generate should declare identity_source")
            elif clip_type == "graphic":
                if role and role != "graphic":
                    warnings.append(f"{label}: graphic clip should use role='graphic'")
            else:
                errors.append(f"{label}: unsupported type '{clip_type}'")

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Second Act visual-plan semantics")
    parser.add_argument("--plan", required=True)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    plan_path = Path(args.plan).resolve()
    plan = load_json(plan_path)
    errors, warnings = validate(plan, args.strict)
    report = {"plan": str(plan_path), "success": not errors, "errors": errors, "warnings": warnings}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not errors else 2


if __name__ == "__main__":
    raise SystemExit(main())
