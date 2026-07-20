# Runbook

1. Start dependencies with `pnpm infra:up` and configure `.env`.
2. Start API and Studio; run or resume only the necessary workflow stage.
3. For a failed asset or clip, retry that child job. Do not rerun completed siblings.
4. Inspect the approved asset binding and `ResolvedStoryboard` before composition.
5. Validate the rendered MP4 with `pnpm tsx scripts/verify-render.ts out/<pilot>.mp4`.

For targeted regeneration, edit the layer prompt or selected variant, approve the replacement, then rebuild the derived `ResolvedStoryboard`, composition, render, QA, and publishing artifacts. A changed prompt or style-profile version is a cache miss; an identical approved fingerprint is a cache hit.
