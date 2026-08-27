# Second Act Stories + OpenMontage

This branch adds an end-to-end pilot path for the US 55+ storytelling format.

## Goal

Use the existing `story-video` system for story generation, voice and Remotion rendering, while delegating real-footage B-roll acquisition to OpenMontage's `direct_clip_search` tool.

OpenMontage's documentary path is retrieval-first and can source real footage from Pexels, Archive.org, NASA, Wikimedia Commons and Unsplash. This repository calls the retrieval layer without vendoring OpenMontage.

## Local layout

Recommended sibling folders:

```text
workspace/
  story-video/
  OpenMontage/
```

Or configure `.env`:

```text
OPENMONTAGE_PATH=/absolute/path/to/OpenMontage
OPENMONTAGE_PYTHON=/absolute/path/to/OpenMontage/.venv/bin/python
```

On Windows, `OPENMONTAGE_PYTHON` can point to `.venv\\Scripts\\python.exe`.

## Setup

Install OpenMontage once:

```sh
git clone https://github.com/calesthio/OpenMontage.git
cd OpenMontage
make setup
```

Archive.org, NASA and Wikimedia can work without paid API keys. Add Pexels or Unsplash keys for a broader stock pool.

For `story-video`, use Node 22 and pnpm 9.15.0 as documented in the main README. The pilot also expects the configured local OpenAI-compatible LLM and CapCut TTS service to be running.

## One-command pilot

From `story-video`:

```sh
pnpm second-act:pilot -- --topic "A 63-year-old woman rebuilds her life after gray divorce and discovers her retirement plan was built around the marriage" --minutes 4
```

The topic can be written in Vietnamese; the generator outputs natural US English for Americans 55+.

## What the pilot does

```text
Vietnamese or English topic
  -> original US-55+ story in English
  -> 14-18 narration beats
  -> CapCut TTS audio per beat
  -> stock-footage queries per beat
  -> OpenMontage real-footage retrieval
  -> first usable clip selected per beat
  -> provenance/license metadata saved
  -> 1920x1080 Remotion timeline
  -> narration + subtitles + stock footage
  -> MP4 + publishing package
```

Output is written under:

```text
out/second-act/<story-slug>/
  story.json
  visual-spec.json
  audio/
  footage/
  openmontage-result.json
  footage-provenance.json
  remotion-props.json
  <story-slug>.mp4
  publishing-package.json
```

## Editorial guardrails

The `Second Act Stories` generator is intentionally tuned for American later-life themes: gray divorce, retirement, job loss after 55, rebuilding finances, adult-child boundaries, caregiving, loneliness, identity after work and second chances. It avoids Asian filial-duty framing, implausible billionaire/revenge twists and personalized legal/medical/financial advice.

The pilot uses one stock clip per narration beat for stability. Once the 3-5 minute pilot is visually and editorially acceptable, the next optimization is to rotate 2-3 clips within longer beats and then scale runtime toward 20-40 minutes.
