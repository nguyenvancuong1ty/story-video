# Knowledge Story Video Factory Design

**Goal:** Build a durable production system that turns verified knowledge into localized, layered visual-story videos across content domains and audience markets.

**Architecture:** A single-user React Flow Studio is a control and review surface only. The API, PostgreSQL, object storage, Redis/BullMQ, and workers own workflow execution, durable state, artifacts, retries, optional review gates, and rendering. Every output is an immutable, versioned artifact with provenance.

**MVP scope:** History, Mystery & Mythology, and Civilization & Culture; fixed 15-stage workflow; Japanese plus Vietnamese or English output; one image provider, one TTS provider, 60–90 second vertical videos, and a paper-collage Remotion renderer.

## System Boundary

```text
Studio (React Flow) → API / Orchestrator → Workers → PostgreSQL + Object Storage
```

| Module | Responsibility |
|---|---|
| `schemas` | Runtime validation and TypeScript contracts for all inputs and artifacts. |
| `orchestration` | Stage dependencies, state transitions, retries, approvals, resume, and job dispatch. |
| `research` | Fact packages, sources, claim confidence, disputes, and truth-policy checks. |
| `editorial` | Angle selection, market localization, script, pronunciation notes, and director storyboard. |
| `assets` | Asset planning, image-provider adapters, variants, processing, visual QA, library, and continuity. |
| `audio` | Text normalization, pronunciation dictionaries, TTS adapters, audio processing, timing, and subtitles. |
| `rendering` | Composition, motion presets, Remotion rendering, and technical media QA. |
| `studio` | Workflow observation/control and artifact review; never execution truth. |

## Non-Negotiable Rules

- The backend, not browser state, is the execution source of truth.
- Artifacts are immutable and versioned; derived artifacts link to every direct input artifact.
- Providers are adapters. MVP configures one image and one TTS implementation without embedding provider assumptions in domain objects.
- A failure in one asset or narration clip must not rerun independent completed children.
- The user can enable optional review gates for localized script, character/reference assets, and final render. All other stages run without approval by default.
- Every project has a `truthPolicy`. Alternate history carries an explicit fictional label in narration metadata and publishing output.

## Artifact Graph

```text
ProjectConfig
→ FactPackage
→ EditorialPackage
→ LocalizedScript
→ Storyboard
├── AssetManifest → AssetVariants → ApprovedAssets
└── AudioPlan → NarrationClips → TimedSubtitles
→ CompositionPackage
→ RenderPackage
→ QAReport
→ PublishingPackage
```

All artifacts share this envelope:

```ts
type Artifact<T> = {
  id: string;
  projectId: string;
  kind: string;
  version: number;
  status: "draft" | "ready" | "approved" | "rejected";
  inputArtifactIds: string[];
  payload: T;
  createdAt: string;
  createdBy: "user" | "worker";
};
```

## Workflow

The fixed workflow has 15 stages: Input, Research, Fact Check, Editorial Angle, Localization, Script, Storyboard, Asset Planning, Image Generation, TTS, Timing & Subtitle, Composition, Render, QA, and Publishing Package. Publishing remains disabled until a later integration; the MVP generates the package artifact.

Stages use `pending`, `running`, `awaiting_approval`, `completed`, `failed`, or `cancelled`. Each execution stores input/output artifact IDs, job ID, retry count, short log, cost, timestamps, and structured error code.

Image Generation and TTS fan out to per-asset and per-clip child jobs. The parent stage aggregates child status and supports targeted retry or replacement.

## Director Storyboard and Rendering

Each scene must specify a narrative beat, primary subject, ordered layers, camera intent, entrance order, emotional beat, motion preset, subtitle safe area, and asset requirements. It is the single composition contract consumed by Remotion.

The renderer implements layered paper-collage: independent alpha assets, explicit z-index, background parallax, distinct primary/secondary/tertiary motion presets, staggered entrance, paper outlines, shadow, and scene-level text safe zones. It does not animate a single flattened image.

## Image Pipeline

```text
Storyboard → Asset Planner → Prompt Generator → Provider Adapter
→ Variant Generation → Download/Alpha/Canvas Processing → Visual QA → Asset Library
```

Asset states are `PLANNED`, `PROMPT_READY`, `GENERATING`, `GENERATED`, `PROCESSING`, `VALIDATING`, `APPROVED`, and `FAILED`. Each asset records prompt and negative-prompt versions, references, provider/model, ratio, transparency requirement, cultural/period metadata, variant artifacts, and processing/QA results.

The Studio supports prompt edit, targeted regenerate, variant selection, character-master reference assignment, and library reuse. Processing validates resolution, removes backgrounds when necessary, trims transparent bounds, normalizes canvases, creates thumbnails, and preserves original output.

## Audio Pipeline

```text
Final Script → Text Normalization → Pronunciation Dictionary → TTS Adapter
→ Loudness/Silence Processing → Duration Measurement → Subtitle Timing → Audio QA
```

Audio is synthesized by scene/clip. Each clip stores source and normalized text, language, voice configuration, pronunciation version, media artifact URL, duration, loudness report, and subtitle cue artifact. Japanese uses explicit readings for people, places, era names, classical Sino-Japanese vocabulary, and foreign names.

Measured narration duration is authoritative. Timing updates scene durations before composition and rendering.

## Studio and Quality Assurance

React Flow visualizes the fixed workflow and reads backend state. The single-user Studio has a configuration panel, the workflow graph, and a node detail panel for artifacts and actions. Nodes show status, progress, cost, warnings, short logs, artifact preview, retry, rerun-from-stage, and optional approval controls. Review screens cover sources/claims, scripts/pronunciations, image variants, audio clips, and final renders. The MVP explicitly excludes roles, permissions, collaboration, multi-tenancy, and enterprise audit features.

QA produces separate factual, creative, and technical reports:

- Factual: source-backed claims, confidence, disputed interpretations, speculation and fiction labels.
- Creative: subject hierarchy, asset continuity, crop, alpha, layer order, motion, safe areas, and subtitle overlap.
- Technical: image resolution, aspect ratio, duration, frame rate, stream presence, loudness, silence, and render failure.

## Operations

Local development uses Docker for PostgreSQL, Redis, and S3-compatible object storage. API and worker telemetry capture stage duration, child-job outcomes, provider failures, retries, cache use, and cost per project and artifact. The storage and provider boundary permits later managed-service migration without changing schemas or workflow contracts.

## Milestone Sequence

1. Foundation, schemas, artifact versioning, and local runtime.
2. Orchestrator, durable workflow state, queue, worker contract, and approvals.
3. Research, fact verification, editorial, localization, script, and storyboard.
4. Image planning, provider adapter, processing, QA, library, and continuity.
5. TTS, pronunciation, processing, timing, and subtitles.
6. Remotion composition, render worker, and technical QA.
7. React Flow Studio, review UI, retries, approvals, and observability.
8. Three localized pilots and production hardening.

## Acceptance Standard

The MVP is accepted when the same engine renders three Japanese 60–90 second vertical pilots in different pillars—Rome's fall, Pompeii's disappearance, and pyramid construction—without code changes per topic; when artifacts can be traced from MP4 to sources; and when one failed asset or audio clip can be independently replaced and the project resumed.
