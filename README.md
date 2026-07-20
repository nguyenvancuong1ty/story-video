# Knowledge Story Video Factory

Single-user workflow studio for localized layered knowledge-story videos.

## Local setup

Use Node 22 and pnpm 9.15.0. Copy `.env.example` to `.env`, then run `pnpm install` and `pnpm infra:up`.

## Verify fixtures

Run `pnpm tsx scripts/run-pilot.ts --pilot rome-ja` to write an offline, source-traceable publishing package. For the real Vietnamese layered slice, use Node 22, configure `LOCAL_IMAGE_BASE_URL` and `LOCAL_IMAGE_MODEL` in `.env`, start the local CapCut TTS service, then run `pnpm tsx scripts/run-pilot.ts --pilot rome-vi --credentialed`. It produces `out/rome-vi.mp4` and a source-traceable publishing package. See `docs/runbook.md` for provider startup, recovery, and MP4 verification.
