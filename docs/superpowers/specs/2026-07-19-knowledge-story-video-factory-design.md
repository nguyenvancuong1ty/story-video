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
| `research` | Research-provider adapter, fact packages, sources, claim confidence, disputes, and truth-policy checks. |
| `editorial` | Language-model adapter, angle selection, market localization, script, pronunciation notes, and director storyboard. |
| `assets` | Asset planning, image-provider adapters, variants, processing, visual QA, library, and continuity. |
| `audio` | Text normalization, pronunciation dictionaries, TTS adapters, audio processing, timing, and subtitles. |
| `rendering` | Composition, motion presets, Remotion rendering, and technical media QA. |
| `studio` | Workflow observation/control and artifact review; never execution truth. |

## Non-Negotiable Rules

- The backend, not browser state, is the execution source of truth.
- Artifacts are immutable and versioned; derived artifacts link to every direct input artifact.
- Providers are adapters. MVP configures research, language-model, image, and TTS implementations without embedding SDK assumptions in domain objects.
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
├── AssetManifest (one job per generated layer) → AssetVariants → ApprovedAssets
├── ResolvedStoryboard (layerId → approvedAssetId)
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

## Research and Editorial Providers

`research` owns `ResearchProvider.search(input): Promise<ResearchSource[]>`; each source records provider source ID, title, URL, excerpt, publication date when available, and retrieval timestamp. `editorial` owns `LanguageModelProvider.generateStructured<T>(input: StructuredPrompt<T>): Promise<T>`; every structured request supplies its Zod schema, prompt version, language, and model identifier.

MVP configures `OpenAiWebSearchResearchProvider` and `OpenAiLanguageModelProvider`. `OPENAI_RESEARCH_MODEL` and `OPENAI_EDITORIAL_MODEL` are required, separately versioned environment settings; the selected provider and model are persisted in FactPackage, EditorialPackage, LocalizedScript, and DirectorStoryboard provenance. Research, verification, localization, scripting, and storyboard domain code depend only on these interfaces. Tests use fake providers and fixtures, never provider SDKs or credentials.

## Director Storyboard and Rendering

Each scene must specify a narrative beat, primary subject, an ordered set of `SceneLayer` objects, camera plan, subtitle safe area, and asset requirements. A layer has a stable `id`, role, subject, source type, generation intent or selected asset, explicit layout, and independent motion timing. It is the single visual-intent contract consumed by Asset Planning and, after resolution, by Remotion.

`SceneLayer.role` is one of background, tertiary, secondary, primary, foreground, effect, or overlay. `assetType` is generated image, library image, SVG, text, or particle. Generated-image layers carry prompt intent, reference asset IDs, and a transparency requirement; every such layer produces one or more asset jobs keyed by its `sceneId` and `layerId`. For every generated-image layer, `AssetJob.alphaRequired` equals `generation.transparentBackground`, regardless of role. SVG, text, and particle layers use internal render assets and never call an image provider.

Each layer owns its layout (`anchorX`, `anchorY`, `widthPercent`, `scale`, `rotation`, `zIndex`) and motion (`preset`, `startFrame`, optional `endFrame`, `intensity`). Each scene owns a camera plan with preset, direction, start/end scale, start/end X/Y, and easing. Rendering must execute these supplied values; it may validate them or provide documented defaults, but it must not select the motion language from a layer role.

The storyboard remains immutable. Asset Planning produces an `AssetManifest`; approval produces a derived `ResolvedStoryboard` that binds every provider or library asset to its source `layerId`. `CompositionPackage` is built only from the approved `ResolvedStoryboard`, narration, and subtitle artifacts. This preserves a trace from every rendered layer to both the storyboard intent and its approved asset.

The renderer implements layered paper-collage: independent alpha assets, explicit z-index, per-layer motion, camera transforms, paper outlines, shadow, and scene-level text safe zones. Internal SVG/CSS layers provide smoke, snow, dust, embers, paper grain, ink wipes, arrows, timelines, map routes, and labels without image generation. It does not animate a single flattened image.

## Image Pipeline

```text
Storyboard SceneLayer[] → Asset Planner → AssetManifest
→ Prompt Generator → Provider Adapter → Variant Generation
→ Download/Alpha/Canvas Processing → Visual QA → ApprovedAssets
→ ResolvedStoryboard
```

Asset states are `PLANNED`, `PROMPT_READY`, `GENERATING`, `GENERATED`, `PROCESSING`, `VALIDATING`, `APPROVED`, and `FAILED`. Each asset records its source `sceneId` and `layerId`, prompt and negative-prompt versions, references, provider/model, ratio, transparency requirement, cultural/period metadata, variant artifacts, and processing/QA results.

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
