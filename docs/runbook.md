# Runbook

1. Start dependencies with `pnpm infra:up` and configure `.env`.
2. Start API and Studio; run or resume only the necessary workflow stage.
3. For a failed asset or clip, retry that child job. Do not rerun completed siblings.
4. Inspect the approved asset binding and `ResolvedStoryboard` before composition.
5. Validate the rendered MP4 with `pnpm tsx scripts/verify-render.ts out/<pilot>.mp4`.

For targeted regeneration, edit the layer prompt or selected variant, approve the replacement, then rebuild the derived `ResolvedStoryboard`, composition, render, QA, and publishing artifacts. A changed prompt or style-profile version is a cache miss; an identical approved fingerprint is a cache hit.

## Credentialed Rome vertical slice

1. Use Node 22 and pnpm 9.15.0, then run `pnpm install --frozen-lockfile`.
2. Add `OPENROUTER_API_KEY` and `OPENROUTER_IMAGE_MODEL` to the local `.env`; the local LLM defaults to `http://localhost:20128/v1` and `cx/gpt-5.6-terra`.
3. Start CapCut Web TTS at `http://127.0.0.1:8765` from `/home/cuongdev/Documents/voice_video` with `python3 web_tts.py`.
4. Run `pnpm tsx scripts/run-pilot.ts --pilot rome-ja --credentialed`.
5. Run `pnpm tsx scripts/verify-render.ts out/rome-ja.mp4`.

The command fails before remote image generation when local LLM or CapCut is unavailable. A clean run creates six new images (never more than ten), six CapCut MP3 clips, `out/rome-ja.mp4`, and `out/rome-ja.publishing-package.json`.
