# Second Act Visual Direction

Use this project extension when planning or reviewing Second Act Stories: narrated, documentary-style stories for a 55+ U.S. audience.

## Core promise

Keep the emotional story clear while avoiding fake character continuity. Prefer a coherent symbolic documentary over a sequence of unrelated stock faces.

## Protagonist continuity

- Treat the protagonist as one persistent character, normally a U.S. woman in her early-to-mid 60s unless the story says otherwise.
- Do not show a clearly different person as the protagonist from shot to shot.
- If exact identity cannot be preserved with stock, prefer face-safe coverage: hands, over-the-shoulder, back/side silhouette, environment, objects, paperwork, vehicles, or wide shots.
- A visibly wrong age or gender is a hard rejection for a protagonist shot.
- Never use a man as visual shorthand for a female protagonist.
- Do not use a visibly 20-40-year-old woman to portray a protagonist in her 60s.

## Shot routing

Route every planned shot to one of `stock`, `ai_generate`, or `graphic`.

- Use `stock` for places, routines, finance objects, hands, transportation, workplaces, community, nature, and other generic documentary coverage.
- Use `ai_generate` only when the shot must show the persistent protagonist or a highly specific emotional situation that stock cannot represent safely.
- Use `graphic` for numbers, timelines, chapter cards, or facts that need exact text.
- Cap AI-generated footage at 20% of total duration unless explicitly overridden.
- If no AI-video provider is configured, replace `ai_generate` with continuity-safe stock; do not pretend a mismatched stock actor is the protagonist.

## Retrieval rules

- Write concrete 2-6 word stock-search concepts; avoid prose prompts.
- Search for the action/object/environment before searching for a face.
- Retrieve multiple candidates and inspect actual thumbnails before selection.
- Reject logo-heavy, geographically wrong, visually confusing, or narratively contradictory footage.
- Avoid readable fake legal, medical, or financial documents when exact wording matters.

## Pacing and composition

- Target 4-7 seconds per documentary shot for this older audience; slow down only for emotional holds.
- Use hard cuts or subtle dissolves. Avoid flashy transition grammar.
- The first 15 seconds must visualize the specific crisis immediately, not generic office footage.
- Maintain visual variety without sacrificing coherence: alternate person-safe coverage, objects, environments, and wide context.
- Prefer real motion footage over animated stills when equivalent footage exists.

## Quality gate

Before accepting a cut, check: narration match, protagonist continuity, age/gender correctness, geographic plausibility, technical quality, logos/text, and unnecessary reuse.

After render, inspect frames from the opening plus every protagonist-heavy beat. Replace any shot that makes the viewer infer a different protagonist. A technically valid render is not a quality pass if the story-to-visual mapping is wrong.

## Local LTX AI routing

- Local AI provider is `scripts/ltx-comfy-provider.py`, backed by ComfyUI on `127.0.0.1:8188` and LTX-Video 2B distilled.
- For stable protagonist anchor shots, use a persistent reference image plus dual `LTXVAddGuide` conditioning at the first and last frame.
- Default tested preset: 768x448, 24 fps, 121 output frames (~5.04s), 20 steps, start guide strength 2.0, end guide strength 1.25, CFG 1.0.
- Always crop inserted guide latents with `LTXVCropGuides` before VAE decode so output duration remains the requested shot length.
- This preset is appropriate for subtle hero/anchor motion in the same or closely related environment. Do not assume it can freely change backgrounds while preserving identity.
- A plan may put an `ai_generate` object directly inside a beat's `clips` array. Required fields are `type`, `id`, `reference`, and `prompt`; optional fields include `duration`, `seed`, `width`, `height`, `start_strength`, and `end_strength`.
- Generated clips are materialized before composition and enter the OpenMontage asset manifest as `source: ltx-comfy`, `license: generated`.
- If a generated shot produces an extra person, obvious identity drift, wrong age, changed hair/outfit, malformed hands, or beauty-filter skin, reject and regenerate; technical encode success alone is not acceptance.
