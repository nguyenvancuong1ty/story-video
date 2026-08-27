# Second Act Stories + OpenMontage

This branch adds the first integration layer for the US 55+ storytelling format.

## Goal

Use the existing story-video system for script, voice, orchestration and final render, while delegating real-footage B-roll acquisition to OpenMontage's `direct_clip_search` tool.

OpenMontage's documentary pipeline is retrieval-first and can source real footage from Pexels, Archive.org, NASA, Wikimedia Commons and Unsplash. The bridge in this repo intentionally calls only the footage-retrieval layer first, instead of vendoring or duplicating OpenMontage.

## Local layout

Recommended sibling folders:

```text
workspace/
  story-video/
  OpenMontage/
```

Or set:

```text
OPENMONTAGE_PATH=/absolute/path/to/OpenMontage
```

## Setup

In OpenMontage:

```sh
git clone https://github.com/calesthio/OpenMontage.git
cd OpenMontage
make setup
```

At least Archive.org, NASA and Wikimedia can work without paid API keys. Add Pexels or Unsplash keys when you want a larger stock pool.

In story-video, keep using the pinned Node/pnpm setup from the main README.

## Retrieval spec

Example file `out/second-act/visual-spec.json`:

```json
{
  "clips_per_query": 2,
  "filters": {
    "orientation": "landscape",
    "min_width": 1280,
    "min_duration": 4
  },
  "queries": [
    {
      "slot_id": "hook-01",
      "query": "older American woman alone at kitchen table morning",
      "kind": "video"
    },
    {
      "slot_id": "retirement-01",
      "query": "quiet suburban American home exterior older couple",
      "kind": "video"
    },
    {
      "slot_id": "reset-01",
      "query": "older woman driving alone open road United States",
      "kind": "video"
    }
  ]
}
```

## Run

Use the Python environment where OpenMontage was installed:

```sh
python scripts/openmontage-retrieve.py \
  --spec out/second-act/visual-spec.json \
  --output out/second-act/footage
```

The script writes:

```text
out/second-act/footage/
  clips/
  thumbnails/
  openmontage-result.json
```

Each returned clip preserves source/provenance metadata from OpenMontage so later publishing checks can retain license and original URL information.

## Intended production flow

```text
Vietnamese topic brief
  -> English US-55+ story script
  -> TTS narration
  -> scene/beat planner
  -> visual-spec.json
  -> OpenMontage footage retrieval
  -> clip selection
  -> Remotion/FFmpeg assembly
  -> subtitles + music
  -> final 16:9 YouTube render
```

## Next implementation step

The next code slice should add a dedicated `second-act` pilot that:

1. produces a US-culturally localized story;
2. emits narration beats plus stock-footage search queries;
3. invokes this OpenMontage bridge automatically;
4. maps selected clips onto a 16:9 Remotion timeline;
5. renders a 3-5 minute pilot before scaling to 20-40 minute videos.

Do not jump directly to 30+ minute production until the short pilot has acceptable narration quality, clip relevance, pacing and render stability.
