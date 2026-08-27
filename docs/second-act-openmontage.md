# Second Act Stories + OpenMontage

This branch contains an end-to-end 3-5 minute pilot path for English-language storytelling aimed at Americans age 55 and older.

## What it builds

```text
Vietnamese or English topic
  -> original US-55+ story in natural English
  -> 14-18 narration beats
  -> 3-5 distinct visual searches per beat
  -> CapCut TTS narration
  -> OpenMontage real-footage retrieval
  -> commercial-use license filtering
  -> 3-5 short B-roll shots per beat
  -> crop/reframe motion + crossfades + unified color treatment
  -> chapter cards + restrained quote typography + subtitles
  -> optional licensed music and ambience
  -> 1920x1080 MP4 + edit plan + publishing package
```

The original audio from every stock clip is muted. Narration is the primary audio layer.

## Local layout

Use sibling folders:

```text
workspace/
  story-video/
  OpenMontage/
```

Or configure explicit paths in `story-video/.env`:

```text
OPENMONTAGE_PATH=C:\\AI\\OpenMontage
OPENMONTAGE_PYTHON=C:\\AI\\OpenMontage\\.venv\\Scripts\\python.exe
```

## Install

`story-video` requires Node 22 and pnpm 9.15.0. Do not use `npm install` in this repository.

```powershell
cd story-video
git fetch origin
git switch feat/second-act-openmontage
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Install OpenMontage in the sibling folder using its own setup instructions. The retrieval bridge imports OpenMontage's Python `DirectClipSearch` implementation.

The pilot also requires:

- the configured local OpenAI-compatible LLM service;
- the configured CapCut TTS service;
- FFmpeg/ffprobe;
- at least one available OpenMontage stock provider.

## Stock safety configuration

The default `.env.example` uses:

```text
PEXELS_API_KEY=
SECOND_ACT_STOCK_SOURCES=pexels
SECOND_ACT_LICENSE_MODE=safe
SECOND_ACT_CLIPS_PER_QUERY=2
```

Create a free Pexels API key and set `PEXELS_API_KEY`. `safe` mode accepts Pexels/Unsplash provider media and explicitly permissive licenses such as CC0, public domain and non-restrictive CC BY. It rejects unknown licenses, non-commercial variants, no-derivatives variants, share-alike variants and all-rights-reserved media.

This filtering reduces risk; it is not a legal guarantee. Before publishing, review `footage-provenance.json`, source URLs and license records. Do not switch to `--license-mode all` for production unless every selected file has been reviewed manually.

## Run a pilot

From `story-video`:

```powershell
pnpm second-act:pilot -- --topic "Người phụ nữ 63 tuổi ly hôn sau 35 năm và phải xây lại kế hoạch nghỉ hưu từ đầu" --minutes 4
```

The topic may be Vietnamese. The finished story and narration are generated in natural American English.

An explicit license mode may also be passed:

```powershell
pnpm second-act:pilot -- --topic "..." --minutes 4 --license-mode safe
```

## How the dense edit works

Each narration beat receives 3-5 practical stock queries, normally covering an establishing place, a human action, a detail/object, a transitional image and an optional second action. The renderer then:

1. chooses a non-reused, license-compatible clip for each visual slot when possible;
2. adapts the number of shots to the measured narration duration;
3. distributes the shots across the beat with short overlaps;
4. applies deterministic slow push-ins, pull-outs, pans, subtle reframing or slight slow motion;
5. starts each source clip at a deterministic interior time instead of always using its first frame;
6. applies one visual tone across the beat so mixed stock footage feels more coherent;
7. adds a chapter card every four beats and occasional key-phrase typography;
8. keeps stock audio muted and lays narration, optional ambience and optional background music separately.

For a typical four-minute pilot, this creates roughly 55-80 B-roll cuts rather than one long stock clip per narration beat.

## Optional licensed audio

Only use audio you own or are licensed to publish.

```text
SECOND_ACT_MUSIC_PATH=C:\\media\\licensed-music.mp3
SECOND_ACT_AMBIENCE_DIR=C:\\media\\ambience
```

The ambience directory may contain:

```text
room-tone.mp3
rain.mp3
suburban-traffic.mp3
office.mp3
car-interior.mp3
paper.mp3
```

Missing ambience files are skipped without failing the render.

## Output

```text
out/second-act/<story-slug>/
  story.json
  visual-spec.json
  audio/
  footage/
  openmontage-result.json
  edit-plan.json
  footage-provenance.json
  remotion-props.json
  <story-slug>.mp4
  publishing-package.json
```

Inspect `edit-plan.json` for the final shot timeline and `footage-provenance.json` before uploading to YouTube.

## Scaling

Validate the pilot first: story quality, voice naturalness, stock relevance, pacing, license records and render stability. After the format is working, the same pipeline can be extended toward 20-40 minute episodes with asset caching, recurring B-roll libraries and stricter duplicate-shot controls.
