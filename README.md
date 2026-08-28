# Knowledge Story Video Factory

Single-user workflow studio for localized layered knowledge-story videos.

## Local setup

Use Node 22 and pnpm 9.15.0. This repository is a pnpm workspace; do not run `npm install`, because npm cannot safely consume pnpm's workspace lockfile and node_modules layout.

Copy `.env.example` to `.env`, then enable the pinned package manager and install from the lockfile:

```sh
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm infra:up
```

`npm` 11 and newer is configured to stop before installation and report that pnpm is required.

## Verify fixtures

Run `pnpm tsx scripts/run-pilot.ts --pilot rome-ja` to write an offline, source-traceable publishing package. For the real Vietnamese layered slice, use Node 22, select the LLM and image providers in `.env`, start the local CapCut TTS service, then run `pnpm tsx scripts/run-pilot.ts --pilot rome-vi --credentialed`. It produces `out/rome-vi.mp4` and a source-traceable publishing package. See `docs/provider-setup.md` and `docs/runbook.md` for provider configuration, recovery, and MP4 verification.

## Second Act Stories pilot

The `feat/second-act-openmontage` branch adds a 1920x1080 English storytelling pipeline for Americans age 55 and older. It accepts a Vietnamese or English topic, writes a culturally localized story, creates narration, retrieves real B-roll through a sibling OpenMontage checkout, filters stock licenses, and assembles a dense 3-5-shot-per-beat Remotion edit.

After configuring `.env`, run:

```sh
pnpm second-act:pilot -- --topic "Người phụ nữ 63 tuổi ly hôn sau 35 năm và phải xây lại kế hoạch nghỉ hưu từ đầu" --minutes 4 --license-mode safe
```

See `docs/second-act-openmontage.md` for OpenMontage setup, Pexels configuration, optional licensed music/ambience and output files.
