#!/usr/bin/env python3
"""Bridge story-video to OpenMontage's real-footage retrieval tool.

OpenMontage stays as a sibling checkout instead of being vendored into this repo.
This keeps the integration small and makes OpenMontage upgrades independent.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Retrieve B-roll with OpenMontage")
    parser.add_argument("--spec", required=True, help="JSON file containing queries and filters")
    parser.add_argument("--output", required=True, help="Directory for downloaded clips")
    parser.add_argument(
        "--result",
        default="",
        help="Optional result JSON path; defaults to <output>/openmontage-result.json",
    )
    parser.add_argument(
        "--openmontage",
        default="",
        help="OpenMontage checkout path. Defaults to OPENMONTAGE_PATH or ../OpenMontage",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError("spec must be a JSON object")
    return payload


def main() -> int:
    args = parse_args()
    spec_path = Path(args.spec).resolve()
    output_dir = Path(args.output).resolve()
    result_path = Path(args.result).resolve() if args.result else output_dir / "openmontage-result.json"

    openmontage_path = Path(
        args.openmontage
        or os.environ.get("OPENMONTAGE_PATH", "")
        or (Path.cwd().parent / "OpenMontage")
    ).resolve()

    if not openmontage_path.exists():
        raise FileNotFoundError(
            f"OpenMontage checkout not found at {openmontage_path}. "
            "Set OPENMONTAGE_PATH or pass --openmontage."
        )

    sys.path.insert(0, str(openmontage_path))
    try:
        from tools.video.direct_clip_search import DirectClipSearch
    except Exception as exc:  # pragma: no cover - depends on external checkout
        raise RuntimeError(
            "Could not import OpenMontage. Run OpenMontage setup first and use its Python environment."
        ) from exc

    spec = load_json(spec_path)
    queries = spec.get("queries")
    if not isinstance(queries, list) or not queries:
        raise ValueError("spec.queries must be a non-empty array")

    output_dir.mkdir(parents=True, exist_ok=True)
    inputs: dict[str, Any] = {
        "output_dir": str(output_dir),
        "queries": queries,
        "clips_per_query": int(spec.get("clips_per_query", 2)),
        "filters": spec.get(
            "filters",
            {
                "orientation": "landscape",
                "min_width": 1280,
                "min_duration": 4,
            },
        ),
        "extract_thumbnails": bool(spec.get("extract_thumbnails", True)),
        "skip_existing": bool(spec.get("skip_existing", True)),
        "timeout_seconds": float(spec.get("timeout_seconds", 900)),
    }
    if spec.get("sources"):
        inputs["sources"] = spec["sources"]

    result = DirectClipSearch().execute(inputs)
    payload = {
        "success": result.success,
        "error": result.error,
        "cost_usd": result.cost_usd,
        "duration_seconds": result.duration_seconds,
        "data": result.data,
    }
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(result_path)
    return 0 if result.success else 1


if __name__ == "__main__":
    raise SystemExit(main())
