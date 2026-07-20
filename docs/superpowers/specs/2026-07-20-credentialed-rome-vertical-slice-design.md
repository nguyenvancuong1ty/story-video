# Credentialed Rome Vertical Slice Design

## Goal

Make `rome-ja` a real, repeatable acceptance run: create a project, execute the existing 15-stage workflow through durable backend state, generate provider-backed media, render a vertical MP4, run technical QA, and emit a source-traceable publishing package. The same command path must then support `pompeii-ja` and `pyramids-ja`.

## Scope

- Replace the API's in-memory workflow state with persisted project, execution, stage, artifact, and child-job state.
- Route stage commands from the API through the workflow engine and BullMQ worker; the Studio reads the persisted workflow for the route's actual `projectId`.
- Instantiate OpenAI research/editorial/image and ElevenLabs TTS adapters from environment configuration. Provider/model provenance is written to each derived artifact.
- Make composition and render stages produce a 1080x1920, 30 fps H.264 MP4 through Remotion and retain its storage/artifact reference.
- Add one credentialed `rome-ja` acceptance command and assertions for source lineage, image-cache hit/miss, isolated narration retry, and final MP4 validation.
- Reuse the same acceptance harness for `pompeii-ja` and `pyramids-ja` after Rome succeeds.

## Non-goals

- No provider-settings UI, user authentication, multi-user support, or secret persistence in PostgreSQL.
- No expansion beyond the fixed 15 workflow stages.
- No replacement of the existing prompt/style/artifact contracts unless required to connect the real execution path.

## Architecture and Data Flow

The API validates a command and delegates it to the orchestration command layer. The command creates or updates durable execution rows and enqueues a deterministic BullMQ job. The worker resolves the required input artifacts, invokes the appropriate provider adapter, persists immutable output artifacts and telemetry, and advances only the affected stage or child job.

The render handler consumes an approved `ResolvedStoryboard`, narration, and subtitle artifacts to build the Remotion input. It writes the MP4 to object storage or the configured local artifact store, creates a Render artifact, and runs `verifyRender` before QA can complete. The API returns this persisted state; React Flow remains a projection only.

`run-pilot --pilot rome-ja --credentialed` creates or resumes the Rome project and waits for terminal state. It writes the publishing package and final MP4 under `out/`. The runner performs these acceptance checks:

1. A publishing package traces the final render back to real source artifacts.
2. Re-requesting an identical approved image records a cache hit without another image-provider call; changing prompt or style version produces a cache miss.
3. Retrying one failed or regenerated narration child preserves unrelated approved media IDs.
4. `verifyRender` confirms video and audio streams, 1080x1920 dimensions, 30 fps, and nonzero duration.

## Components

| Component | Responsibility |
| --- | --- |
| API/project service | Persist project commands and expose durable workflow/artifact projections. |
| Orchestration and repositories | Enforce stage transitions, immutable artifacts, child retry, and provenance. |
| Workflow worker | Execute queued stages and child jobs with provider adapters. |
| Provider bootstrap | Load credentials/models/voice from `.env`; never expose secrets to Studio. |
| Rendering handler | Render MP4 from approved artifacts and save the render artifact. |
| Studio | Use route `projectId`, display persisted status/artifacts/logs/cost, submit allowed commands. |
| Acceptance runner | Drive three pilots and verify final media plus targeted retry/cache behavior. |

## Failure Handling

- Missing credentials, unavailable queue/storage, provider failures, and render failures become explicit failed stage/child records with telemetry.
- A retry is scoped to the failed image or narration child whenever possible; completed siblings and their artifact IDs remain unchanged.
- A missing or invalid final MP4 blocks QA and publishing. It cannot be represented as a successful render.
- Acceptance commands fail fast with a readable error and preserve durable records for inspection or resume.

## Verification

- Unit and integration tests cover persisted command handling, worker dispatch, provider bootstrap without secrets, render artifact creation, and targeted retry invariants.
- Browser e2e covers loading a real project route, starting/resuming a stage, viewing an artifact, and retrying a child after reload.
- `pnpm test`, `pnpm lint`, and `pnpm typecheck` pass on Node 22.
- Credentialed acceptance runs `rome-ja`, then `pompeii-ja` and `pyramids-ja`; each has a valid MP4 and publishing package.

## Completion Criteria

The vertical slice is complete only when `rome-ja` is generated through the durable API/worker path with real configured providers, `out/rome-ja.mp4` passes `verify-render`, the acceptance invariants pass, and the same command succeeds for the other two pilots. Provider configuration remains environment-owned; a Provider Settings UI is deferred intentionally.
