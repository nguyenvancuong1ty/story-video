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

## Plan semantics contract

For new production plans, use object entries rather than bare stock IDs whenever a person may be visible.

- `role: protagonist` means the viewer is expected to read the visible person as the story protagonist.
- A stock shot with `role: protagonist` is forbidden unless `continuity_approved: true` was set after visual review against the protagonist reference.
- Prefer `role: environment`, `object`, `hands`, `silhouette`, or `supporting` for stock footage.
- `ai_generate` is the default route for a clear-face protagonist shot.
- Do not infer continuity from search keywords or stock metadata. Inspect the selected asset itself.
- If a stock clip has a clear unidentified face and its narrative role is ambiguous, reject it rather than risk creating a second protagonist.

Recommended v2 stock entry:

```json
{"type":"stock","id":"pexels_123","role":"environment","continuity_approved":false}
```

Recommended protagonist entry:

```json
{"type":"ai_generate","id":"hero_01","role":"protagonist","identity_source":"protagonist/master.png","reference":"protagonist/scenes/hero_01.png","prompt":"..."}
```

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
- For stable protagonist anchor shots, use a scene-specific reference image plus dual `LTXVAddGuide` conditioning at the first and last frame.
- Default tested preset: 768x448, 24 fps, 121 output frames (~5.04s), 20 steps, start guide strength 2.0, end guide strength 1.25, CFG 1.0.
- Always crop inserted guide latents with `LTXVCropGuides` before VAE decode so output duration remains the requested shot length.
- This preset is appropriate for subtle motion around the supplied keyframe. Do not ask it to invent a radically different background while also preserving identity.
- A plan may put an `ai_generate` object directly inside a beat's `clips` array. Required fields are `type`, `id`, `reference`, and `prompt`; optional fields include `identity_source`, `role`, `duration`, `seed`, `width`, `height`, `start_strength`, and `end_strength`.
- Generated clips are materialized before composition and enter the OpenMontage asset manifest as `source: ltx-comfy`, `license: generated`.
- If a generated shot produces an extra person, obvious identity drift, wrong age, changed hair/outfit, malformed hands, or beauty-filter skin, reject and regenerate; technical encode success alone is not acceptance.

## Identity-preserving keyframes

Do not treat the official LTX 0.9.8 IC-LoRA detailer as a generic face identity adapter. The production identity path for the current 2B stack is:

`master protagonist portrait -> identity-preserving still generator -> scene-specific keyframe -> LTX I2V`

- Keep one `identity_source` master portrait per story.
- Generate each clear-face scene keyframe from that master with a training-free identity-preserving image model before LTX animation.
- Preferred first implementation is SDXL InstantID because it is single-image, training-free, and practical on a 16 GB GPU.
- Keyframe generation owns identity and background changes; LTX owns temporal motion.
- Reuse outfit/hair descriptors across scene prompts unless the story explicitly changes them.
- Reject a keyframe before video generation if the face, apparent age, hair, or wardrobe has already drifted.
- Only consider training a character-specific LoRA for a recurring channel character; do not train a new LoRA for every one-off story.

## Visual matching

AI footage should not look like a separate visual layer from stock.

- Prefer the LTX spatial latent upscaler when available before final VAE decode.
- Normalize generated assets to the channel delivery raster before composition so the final renderer is not doing the only upscale.
- Use restrained sharpening and texture/grain matching; avoid beauty-filter smoothness, excessive saturation, or synthetic HDR contrast.
- Compare an AI shot directly against its neighboring stock shots during final review, not in isolation.
