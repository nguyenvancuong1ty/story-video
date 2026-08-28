# Codex continuation handoff — 2026-08-28 evening

Read `HANDOFF.md` first. This file is the authoritative delta for the latest local hybrid-video work.

## Current branch and guardrails

- Repository: `nguyenvancuong1ty/story-video`
- Branch: `feat/second-act-openmontage`
- Keep draft PR open; do not merge without explicit user instruction.
- Do not publish externally without explicit user instruction.
- Do not commit `.env`, OAuth tokens, API keys, model weights, render outputs, or local caches.

## Current local stack

- Windows root: `C:\App`
- ComfyUI 0.34.0: `http://127.0.0.1:8188`
- GPU: RTX 5060 Ti 16GB
- LTX: `ltxv-2b-0.9.8-distilled`
- SDXL base 1.0 and PhotoMaker v1 are installed locally.
- OpenMontage sibling: `C:\App\OpenMontage`

## Current identity pipeline

Production identity route is now:

`master portrait -> PhotoMaker SDXL scene keyframe -> LTX I2V -> 1080p normalization -> OpenMontage`

Do not use the official LTX 0.9.8 IC-LoRA detailer as a generic face-identity adapter for this 2B stack.

Key scripts:

- `scripts/photomaker-keyframe-provider.py`
- `scripts/ltx-comfy-provider.py`
- `scripts/normalize-ai-footage.py`
- `scripts/second-act-plan-qa.py`
- `scripts/render-second-act-openmontage.py`

PhotoMaker native node has a practical prompt-length constraint. Keep the positive scene prompt concise; the provider currently enforces <=60 words to avoid the SDXL 154-vs-77 token-mask failure.

## Verified timings / behavior

- Warm PhotoMaker keyframe: ~8.1s in one successful finance-office test; some cold/first-run cases ~17s.
- LTX 5.04s / 121-frame animation: ~35.6s after reconnect/model reload in the finance-office test; warm runs were faster earlier.
- AI normalize to 1920x1080: PASS.
- Sampled finance-office frames showed stable face/hair/outfit, no extra person, and no obvious hand failure.

## Semantic QA state

Visual plans now support explicit clip roles. New production plans should use object entries, not bare stock IDs, when people may be visible.

Important rules:

- Stock `role: protagonist` requires `continuity_approved: true`.
- Prefer stock roles `environment`, `object`, `hands`, or `silhouette` when identity is not guaranteed.
- Clear-face protagonist shots should default to `ai_generate` with an identity source/reference.
- Technical render PASS is not enough; visual continuity must be reviewed.

Wrong continuity stock `pexels_7477075` was identified in beat-02: it visibly showed an older man and was removed from the updated 35s draft.

## Latest hybrid V3

Story slug:

`divorced-at-63-with-no-retirement-how-i-rebuilt-my-life-from`

Latest render:

`C:\App\story-video\out\second-act\divorced-at-63-with-no-retirement-how-i-rebuilt-my-life-from\second-act-openmontage-hybrid-v3-draft35.mp4`

Measured properties:

- duration: ~35.13s
- 1920x1080
- 30fps
- H.264 + audio
- subtitle coverage: 1.0
- OpenMontage final_review: PASS
- semantic QA: PASS for the updated first two beats

Changes from earlier draft:

1. Beat-02 wrong-male stock was removed.
2. Finance beat now uses a generated protagonist office shot after safe stock house/financial-report coverage.
3. Earlier opening AI shot had unnatural hands-near-face motion and was replaced with a new PhotoMaker apartment keyframe + low-motion LTX animation with hands out of frame.

Contact frames for V3 were extracted around 1, 3, 5, 9, 15, 21, 27, and 33 seconds under the run directory `qa_hybrid_v3`. Remote file transport became unreliable before the final complete visual review could be finished.

## Immediate Codex tasks

1. Visually inspect the full V3 draft, not just technical logs.
2. Pay special attention to the opening AI shot, finance-office AI shot, eyes/hands, subtitle placement, face drift, and AI-vs-stock sharpness/color match.
3. If V3 is visually clean, preserve it as the accepted hybrid prototype.
4. If a shot fails visually, regenerate only that shot; do not redesign the pipeline.
5. Migrate remaining legacy bare stock IDs to semantic plan-v2 objects with explicit roles before a full-length production render.
6. Keep clear-face protagonist shots on PhotoMaker -> LTX; use stock mainly for environment, objects, hands, silhouettes, and other continuity-safe coverage.
7. After visual QA, update `HANDOFF.md` with the accepted V3 state and commit/push on the same branch.
