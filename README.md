# Knowledge Story Video Factory

Single-user workflow studio for localized layered knowledge-story videos.

## Local setup

Use Node 22 and pnpm 9.15.0. Copy `.env.example` to `.env`, then run `pnpm install` and `pnpm infra:up`.

## Verify fixtures

Run `pnpm tsx scripts/run-pilot.ts --pilot rome-ja` to write an offline, source-traceable publishing package. For a real-provider vertical slice, use Node 22, configure the provider variables in `.env`, start the local CapCut TTS service, then run `pnpm tsx scripts/run-pilot.ts --pilot rome-ja --credentialed`. It produces `out/rome-ja.mp4` and a source-traceable publishing package. See `docs/runbook.md` for provider startup, recovery, and MP4 verification.
