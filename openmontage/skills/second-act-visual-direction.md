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
