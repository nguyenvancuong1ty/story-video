# Runbook

1. Start dependencies with `pnpm infra:up` and configure `.env`.
2. Start API and Studio; run or resume only the necessary workflow stage.
3. For a failed asset or clip, retry that child job. Do not rerun completed siblings.
4. Inspect the approved asset binding and `ResolvedStoryboard` before composition.
5. Validate the rendered MP4 with `pnpm tsx scripts/verify-render.ts out/<pilot>.mp4`.

For targeted regeneration, edit the layer prompt or selected variant, approve the replacement, then rebuild the derived `ResolvedStoryboard`, composition, render, QA, and publishing artifacts. A changed prompt or style-profile version is a cache miss; an identical approved fingerprint is a cache hit.

## Credentialed Rome vertical slice

1. Use Node 22 and pnpm 9.15.0, then run `pnpm install --frozen-lockfile`.
2. Choose providers in `.env`: `LLM_PROVIDER=local|openrouter` and `IMAGE_PROVIDER=local|openrouter`. The local choices need `LOCAL_LLM_MODEL` and `LOCAL_IMAGE_MODEL`; an OpenRouter choice needs `OPENROUTER_API_KEY` plus its corresponding model variable.
3. Start CapCut Web TTS at `http://127.0.0.1:8765` from `/home/cuongdev/Documents/voice_video` with `python3 web_tts.py`.
4. Run `pnpm tsx scripts/run-pilot.ts --pilot rome-vi --credentialed`.
5. Run `pnpm tsx scripts/verify-render.ts out/rome-vi.mp4`.

The command fails before image generation when the local LLM or CapCut is unavailable, and it validates the credentials for the selected image provider before creating images. A clean run writes CapCut MP3 clips, `out/rome-vi.mp4`, and `out/rome-vi.publishing-package.json`.
