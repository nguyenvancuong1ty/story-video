# Knowledge Story Video Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build a single-user Studio that produces localized 60–90 second layered knowledge-story videos, from sourced facts through generated assets, narration, Remotion rendering, QA, and a publishing package.

**Architecture:** A pnpm TypeScript monorepo separates contracts, orchestration, domain services, media services, rendering, and the Studio. Fastify plus PostgreSQL, Redis/BullMQ, and S3-compatible storage owns durable execution; Next.js plus React Flow only displays state and sends commands.

**Tech Stack:** Node.js 22, pnpm, TypeScript, Zod, Fastify, Drizzle, PostgreSQL, Redis, BullMQ, MinIO, Next.js, React Flow, Vitest, Playwright, Remotion, FFmpeg, Sharp, OpenAI Images, ElevenLabs.

## Global Constraints

- Single-user only: no authentication, roles, collaboration, multi-tenancy, or enterprise audit functionality.
- Persist immutable, versioned artifacts with direct input IDs and provider/template provenance.
- Use exactly 15 stages: Input, Research, Fact Check, Editorial Angle, Localization, Script, Storyboard, Asset Planning, Image Generation, TTS, Timing and Subtitle, Composition, Render, QA, Publishing Package.
- React Flow is never the source of execution state.
- Optional review gates are available only for Script, Character Reference, and Final Render.
- Image and TTS use swappable provider interfaces; configure OpenAI and ElevenLabs for the MVP.
- One image/audio child failure must permit targeted retry without rerunning completed siblings.
- Render 1080x1920 at 30 fps in paper-collage style using independent alpha layers.
- Every project specifies a truth policy; alternate history must be marked fictional.
- Tests use fake providers and fixture artifacts, not credentials.

## Repository Structure

~~~text
apps/
  api/src/{app.ts,server.ts,routes,services}
  studio/{app,components,lib}
  remotion/src/{Root.tsx,VideoComposition.tsx,scenes}
workers/workflow/src/{worker.ts,queues.ts,stage-handlers}
packages/
  schemas/src/{artifact.ts,project.ts,workflow.ts,content.ts,media.ts}
  db/src/{client.ts,schema.ts,repositories}
  orchestration/src/{definition.ts,engine.ts,commands.ts}
  research/src/{facts.ts,verification.ts}
  editorial/src/{angle.ts,localization.ts,script.ts,storyboard.ts}
  assets/src/{provider.ts,service.ts,processing.ts,qa.ts,library.ts}
  audio/src/{provider.ts,normalization.ts,pronunciation.ts,timing.ts,qa.ts}
  rendering/src/{composition.ts,render.ts,qa.ts}
  storage/src/{artifact-store.ts,s3-store.ts}
  test-kit/src/{fakes.ts,fixtures.ts}
infra/{docker-compose.yml,init-minio.sh}
~~~

---

### Task 1: Create the monorepo and local services

**Files:**
- Create: package.json, pnpm-workspace.yaml, tsconfig.base.json, .env.example, .gitignore
- Create: infra/docker-compose.yml, infra/init-minio.sh, .github/workflows/ci.yml
- Create: packages/test-kit/src/fakes.ts, packages/test-kit/test/fakes.test.ts
- Create: README.md

**Interfaces:**
- Produces workspace commands dev, test, lint, typecheck, infra:up, and infra:down.
- Produces createMemoryArtifactStore() for unit tests.

- [ ] **Step 1: Initialize Git and workspace configuration.**

~~~json
{"name":"knowledge-story-video-factory","private":true,"packageManager":"pnpm@9.15.0","scripts":{"test":"pnpm -r test","lint":"pnpm -r lint","typecheck":"pnpm -r typecheck","infra:up":"docker compose -f infra/docker-compose.yml up -d","infra:down":"docker compose -f infra/docker-compose.yml down"}}
~~~

Run: git init && pnpm install  
Expected: Git repository and pnpm lockfile exist.

- [ ] **Step 2: Write the failing memory-store test.**

~~~ts
import {expect, it} from "vitest";
import {createMemoryArtifactStore} from "../src/fakes";
it("reads stored bytes", async () => {
  const store = createMemoryArtifactStore();
  await store.put("a.txt", Buffer.from("a"), "text/plain");
  await expect(store.get("a.txt")).resolves.toEqual(Buffer.from("a"));
});
~~~

Run: pnpm --filter @ksvf/test-kit test  
Expected: FAIL because the function is absent.

- [ ] **Step 3: Implement test fixtures and Docker services.**

~~~ts
export const createMemoryArtifactStore = () => {
  const values = new Map<string, Buffer>();
  return {put: async (key: string, value: Buffer) => void values.set(key, value),
    get: async (key: string) => values.get(key) ?? Promise.reject(new Error("missing artifact"))};
};
~~~

Configure PostgreSQL 16, Redis 7, and MinIO in Docker Compose.

- [ ] **Step 4: Verify and commit.**

Run: pnpm test && pnpm lint && pnpm typecheck && pnpm infra:up  
Expected: tests pass and all containers are healthy.

~~~bash
git add . && git commit -m "chore: initialize video factory"
~~~

### Task 2: Add versioned schemas, database, and artifact storage

**Files:**
- Create: packages/schemas/src/{artifact.ts,project.ts,workflow.ts,content.ts,media.ts,index.ts}
- Create: packages/db/src/{client.ts,schema.ts,repositories/artifacts.ts,repositories/projects.ts,index.ts}
- Create: packages/storage/src/{artifact-store.ts,s3-store.ts,index.ts}
- Test: packages/schemas/test/artifact.test.ts, packages/db/test/artifacts.test.ts

**Interfaces:**
- Produces ArtifactSchema, ProjectConfigSchema, WorkflowStageSchema, and ArtifactRepository.createVersion().
- ArtifactRepository.traceInputs(id) returns all transitive source artifact IDs.

- [ ] **Step 1: Write failing schema tests.**

~~~ts
expect(() => ArtifactSchema.parse({kind: "script"})).toThrow();
expect(ArtifactSchema.parse({id:"art_1",projectId:"prj_1",kind:"LocalizedScript",version:2,status:"ready",inputArtifactIds:["art_0"],payload:{},createdAt:"2026-07-19T00:00:00.000Z",createdBy:"worker"}).version).toBe(2);
~~~

Run: pnpm --filter @ksvf/schemas test  
Expected: FAIL because schemas do not exist.

- [ ] **Step 2: Implement artifact and project contracts.**

~~~ts
export const ArtifactSchema = z.object({
  id:z.string().min(1), projectId:z.string().min(1), kind:z.string().min(1),
  version:z.number().int().positive(), status:z.enum(["draft","ready","approved","rejected"]),
  inputArtifactIds:z.array(z.string()), payload:z.unknown(), createdAt:z.string().datetime(),
  createdBy:z.enum(["user","worker"])
});
~~~

Project configuration must contain contentDomain, topic, storyFormat, audience, presentation, and truthPolicy.

- [ ] **Step 3: Write repository lineage test, implement Drizzle tables, then verify.**

~~~ts
const fact = await repository.createVersion("prj_1","FactPackage",[],{facts:[]});
const script = await repository.createVersion("prj_1","LocalizedScript",[fact.id],{scenes:[]});
expect(await repository.traceInputs(script.id)).toContain(fact.id);
~~~

Create projects, artifacts, artifact_inputs, workflow_runs, stage_executions, asset_jobs, and audio_jobs tables. Enforce increasing project-kind versions.

Run: pnpm --filter @ksvf/schemas test && pnpm --filter @ksvf/db test  
Expected: schema and lineage tests pass.

- [ ] **Step 4: Commit.**

~~~bash
git add packages/schemas packages/db packages/storage && git commit -m "feat: add versioned artifact persistence"
~~~

### Task 3: Implement the durable 15-stage orchestrator

**Files:**
- Create: packages/orchestration/src/{definition.ts,engine.ts,commands.ts,events.ts,index.ts}
- Create: workers/workflow/src/{queues.ts,worker.ts,stage-handlers/index.ts}
- Test: packages/orchestration/test/engine.test.ts, workers/workflow/test/worker.test.ts

**Interfaces:**
- Produces WORKFLOW_STAGES, WorkflowEngine.runStage(), retryChild(), and StageHandler.
- StageHandler is (context: StageContext) => Promise<StageResult>.

- [ ] **Step 1: Write the failing workflow-order test.**

~~~ts
expect(WORKFLOW_STAGES.map((item) => item.key)).toEqual([
 "INPUT","RESEARCH","FACT_CHECK","EDITORIAL_ANGLE","LOCALIZATION","SCRIPT","STORYBOARD",
 "ASSET_PLANNING","IMAGE_GENERATION","TTS","TIMING_SUBTITLE","COMPOSITION","RENDER","QA","PUBLISHING_PACKAGE"
]);
~~~

Run: pnpm --filter @ksvf/orchestration test  
Expected: FAIL because workflow definitions are absent.

- [ ] **Step 2: Implement stage definitions and allowed commands.**

~~~ts
export type StageStatus = "pending"|"running"|"awaiting_approval"|"completed"|"failed"|"cancelled";
export const OPTIONAL_GATE_STAGES = new Set(["SCRIPT","IMAGE_GENERATION","RENDER"]);
export type StageHandler = (context: StageContext) => Promise<StageResult>;
~~~

Character-reference selection controls the optional image gate; non-reference assets do not wait for approval.

- [ ] **Step 3: Write retry test and implement BullMQ persistence.**

~~~ts
await engine.enqueueChild({stage:"TTS",childKey:"scene-01"});
await engine.failChild("scene-01","PROVIDER_TIMEOUT");
await engine.retryChild("scene-01");
expect(await engine.getCompletedChildren("TTS")).toEqual(["scene-02"]);
~~~

Use deterministic job IDs derived from execution ID plus child key. Retry only provider timeout, rate limit, and transient storage errors.

- [ ] **Step 4: Verify and commit.**

Run: pnpm --filter @ksvf/orchestration test && pnpm --filter @ksvf/workflow-worker test  
Expected: 15 stages and independent child retries pass.

~~~bash
git add packages/orchestration workers/workflow && git commit -m "feat: orchestrate durable 15-stage workflows"
~~~

### Task 4: Implement verified research, localization, scripts, and director storyboard

**Files:**
- Create: packages/research/src/{facts.ts,verification.ts,index.ts}
- Create: packages/editorial/src/{angle.ts,localization.ts,script.ts,storyboard.ts,index.ts}
- Test: packages/research/test/verification.test.ts, packages/editorial/test/storyboard.test.ts

**Interfaces:**
- Produces FactPackage, Claim, VerificationReport, LocalizedScript, and DirectorStoryboard artifacts.
- SceneSpec is consumed by asset, audio, and rendering packages.

- [ ] **Step 1: Write and run failing source traceability test.**

~~~ts
expect(verifyClaims({claims:[{id:"c1",sourceIds:[]}]}).blockingIssues)
  .toContainEqual({claimId:"c1",code:"MISSING_SOURCE"});
~~~

Run: pnpm --filter @ksvf/research test  
Expected: FAIL because verification is absent.

- [ ] **Step 2: Implement truth-policy verification.**

Require sources for factual claims; label interpretive, legendary, speculative, and fictional-alt-history claims. Reject alternate-history projects without fictional disclosure metadata.

- [ ] **Step 3: Write failing director scene test and implement SceneSpec.**

~~~ts
expect(() => SceneSpecSchema.parse({id:"scene-01",narrationClipId:"n1"})).toThrow();
~~~

~~~ts
export const SceneSpecSchema = z.object({
 id:z.string(), narrativeBeat:z.string(), primarySubject:z.string(),
 layers:z.array(z.enum(["background","tertiary","secondary","primary","foreground"])).min(2),
 camera:z.object({preset:z.enum(["static","slow-push-in","slow-pan"])}),
 entranceSequence:z.array(z.string()), emotionalBeat:z.string(),
 motionPreset:z.enum(["primaryEntrance","secondaryDrift","backgroundParallax","paperPop"]),
 subtitleSafeArea:z.literal("bottom-18%"), assetRequirements:z.array(z.string()).min(1)
});
~~~

Target-language authors write directly for the market. Japanese scripts require pronunciation entries for ambiguous proper nouns.

- [ ] **Step 4: Verify and commit.**

Run: pnpm --filter @ksvf/research test && pnpm --filter @ksvf/editorial test  
Expected: unsourced claims and incomplete director scenes are rejected.

~~~bash
git add packages/research packages/editorial && git commit -m "feat: add verified localized story packages"
~~~

### Task 5: Implement image assets, processing, QA, library, and continuity

**Files:**
- Create: packages/assets/src/{provider.ts,service.ts,processing.ts,qa.ts,library.ts,types.ts,index.ts}
- Create: workers/workflow/src/stage-handlers/image-generation.ts
- Test: packages/assets/test/{service.test.ts,processing.test.ts,qa.test.ts}

**Interfaces:**
- Produces ImageGenerationProvider.generate(), AssetService.generateAsset(), AssetVariant, and approved Asset artifacts.
- The configured adapter is OpenAiImageProvider; tests use FakeImageProvider.

- [ ] **Step 1: Write failing asset lifecycle test.**

~~~ts
const asset = await service.plan({assetId:"scene-03-character-01",type:"character",sceneId:"scene-03"});
expect(asset.status).toBe("PLANNED");
await service.preparePrompt(asset.assetId,{prompt:"portrait",negativePrompt:"text, watermark"});
expect((await service.get(asset.assetId)).status).toBe("PROMPT_READY");
~~~

Run: pnpm --filter @ksvf/assets test  
Expected: FAIL because AssetService is absent.

- [ ] **Step 2: Implement provider and lifecycle.**

~~~ts
export interface ImageGenerationProvider { generate(input: ImageGenerationInput): Promise<ImageGenerationResult>; }
export type AssetStatus = "PLANNED"|"PROMPT_READY"|"GENERATING"|"GENERATED"|"PROCESSING"|"VALIDATING"|"APPROVED"|"FAILED";
~~~

Persist prompt and negative-prompt version, references, provider/model, ratio, alpha requirement, period/culture metadata, all variants, and selected variant.

- [ ] **Step 3: Write failing alpha QA test, implement Sharp processing, and test reuse.**

~~~ts
const report = await inspectAsset(fixture("transparent-character.png"));
expect(report).toMatchObject({hasAlpha:true,width:2048,issues:[]});
~~~

Preserve originals, trim transparent bounds, normalize canvas, create thumbnail, and reject insufficient resolution, missing alpha, or clipped subject. Permit library reuse only for matching culture, period, and style tags.

- [ ] **Step 4: Verify targeted regenerate and commit.**

Run: pnpm --filter @ksvf/assets test  
Expected: a failed variant regenerates without changing approved sibling variants.

~~~bash
git add packages/assets workers/workflow/src/stage-handlers/image-generation.ts && git commit -m "feat: add image asset generation and QA"
~~~

### Task 6: Implement TTS, pronunciation, timing, subtitles, and audio QA

**Files:**
- Create: packages/audio/src/{provider.ts,normalization.ts,pronunciation.ts,timing.ts,qa.ts,service.ts,index.ts}
- Create: workers/workflow/src/stage-handlers/{tts.ts,timing-subtitle.ts}
- Test: packages/audio/test/{pronunciation.test.ts,timing.test.ts,service.test.ts}

**Interfaces:**
- Produces TtsProvider.synthesize(), NarrationClip, TimedSubtitleCue, and AudioQaReport.
- Composition consumes measured clip duration, never estimated script duration.

- [ ] **Step 1: Write failing Japanese reading test.**

~~~ts
expect(normalizeForSpeech("徳川家康","ja-JP",[{surface:"徳川家康",reading:"とくがわ いえやす"}]))
 .toBe("とくがわ いえやす");
~~~

Run: pnpm --filter @ksvf/audio test  
Expected: FAIL because normalization is absent.

- [ ] **Step 2: Implement provider contracts and fake adapter.**

~~~ts
export interface TtsProvider { synthesize(input: TtsInput): Promise<TtsResult>; }
export type PronunciationEntry = {surface:string;reading:string;language:"ja-JP"};
~~~

Implement ElevenLabsTtsProvider and FakeTtsProvider. Persist source and normalized text, voice settings, pronunciation version, media artifact, duration, and loudness report.

- [ ] **Step 3: Write duration timing test and implement FFmpeg processing.**

~~~ts
const updated = updateSceneTimings(storyboard,[{sceneId:"scene-01",durationMs:4120}]);
expect(updated.scenes[0].durationFrames).toBe(124);
~~~

Normalize loudness, trim silence, measure duration with ffprobe, generate deterministic subtitle cues, and reject absent streams, clipping, zero duration, and missing required readings.

- [ ] **Step 4: Verify independent clip retry and commit.**

Run: pnpm --filter @ksvf/audio test && pnpm --filter @ksvf/workflow-worker test  
Expected: replacing scene-01 narration preserves approved scene-02 media IDs.

~~~bash
git add packages/audio workers/workflow/src/stage-handlers/tts.ts workers/workflow/src/stage-handlers/timing-subtitle.ts && git commit -m "feat: add localized narration pipeline"
~~~

### Task 7: Implement Remotion composition, render worker, and media QA

**Files:**
- Create: apps/remotion/src/{Root.tsx,VideoComposition.tsx,types.ts,motion.ts,scenes/LayeredScene.tsx}
- Create: packages/rendering/src/{composition.ts,render.ts,qa.ts,index.ts}
- Create: workers/workflow/src/stage-handlers/{composition.ts,render.ts,qa.ts}
- Test: packages/rendering/test/{composition.test.ts,qa.test.ts}

**Interfaces:**
- Produces buildComposition(), CompositionPackage, MP4 Render artifact, and QA reports.
- Only buildComposition() converts approved storyboard, assets, audio, and subtitles into renderer input.

- [ ] **Step 1: Write layer hierarchy test.**

~~~ts
expect(buildComposition(scene).layers.map((layer)=>layer.zIndex)).toEqual([0,1,3,5,7]);
~~~

Run: pnpm --filter @ksvf/rendering test  
Expected: FAIL because composition builder is absent.

- [ ] **Step 2: Implement motion language and composition contract.**

~~~ts
export const roleMotion = {
 primary:{distance:78,rise:55,startScale:0.86},
 secondary:{distance:58,rise:38,startScale:0.90},
 tertiary:{distance:38,rise:22,startScale:0.95}
} as const;
~~~

Use independent layers, explicit z-index, low background parallax, staggered primary-secondary-tertiary entrance, paper outline/shadow, and bottom-18% subtitle safe area.

- [ ] **Step 3: Write render-config test, implement renderer, and verify media.**

~~~ts
expect(createRenderConfig()).toMatchObject({width:1080,height:1920,fps:30,codec:"h264"});
~~~

Render with Remotion. Use ffprobe to require one video and one audio stream, 1080x1920, 30 fps, and nonzero duration. Reject subtitle-primary overlap and scenes without a primary layer.

- [ ] **Step 4: Verify fixture render and commit.**

Run: pnpm --filter @ksvf/rendering test && pnpm --filter @ksvf/remotion render:fixture  
Expected: fixture MP4 passes technical and creative QA.

~~~bash
git add apps/remotion packages/rendering workers/workflow/src/stage-handlers && git commit -m "feat: add layered remotion rendering"
~~~

### Task 8: Build the Fastify API and React Flow Studio

**Files:**
- Create: apps/api/src/{app.ts,server.ts,routes/projects.ts,routes/workflows.ts,routes/artifacts.ts,services/project-service.ts}
- Create: apps/studio/app/{page.tsx,projects/[projectId]/page.tsx}
- Create: apps/studio/components/{WorkflowGraph.tsx,WorkflowNode.tsx,ConfigPanel.tsx,ArtifactPanel.tsx,ReviewPanel.tsx}
- Create: apps/studio/lib/api.ts
- Test: apps/api/test/workflows.test.ts, apps/studio/e2e/workflow.spec.ts

**Interfaces:**
- Produces GET project workflow, GET artifacts, and POST stage-command HTTP endpoints.
- Studio consumes GET /projects/:id/workflow and sends POST /projects/:id/stages/:stage/commands.

- [ ] **Step 1: Write failing stage-command endpoint test.**

~~~ts
const response = await app.inject({method:"POST",url:"/projects/prj_1/stages/RESEARCH/commands",payload:{type:"run"}});
expect(response.statusCode).toBe(202);
expect(JSON.parse(response.body)).toMatchObject({stage:"RESEARCH",status:"running"});
~~~

Run: pnpm --filter @ksvf/api test  
Expected: FAIL because routes are absent.

- [ ] **Step 2: Implement validated Fastify commands.**

Permit run, cancel, retry, approve, reject, and rerun_from_here. Reject approval for a stage without enabled optional gate. Return persisted execution state for all commands.

- [ ] **Step 3: Write graph-projection test and implement UI.**

~~~ts
expect(toFlowNodes(workflow)).toHaveLength(15);
expect(toFlowNodes(workflow).find((node)=>node.id==="IMAGE_GENERATION")?.data.progress)
 .toEqual({completed:18,total:24});
~~~

The project page contains config panel, fixed graph, and selected-node artifact panel. Show status, progress, cost, warning, log, preview, and allowed commands. Implement review panels for sources, scripts/readings, variants/references, clips, and MP4. Do not create login or collaboration views.

- [ ] **Step 4: Verify browser workflow and commit.**

Run: pnpm --filter @ksvf/api test && pnpm --filter @ksvf/studio test && pnpm --filter @ksvf/studio e2e  
Expected: start research, inspect output, retry one child, and resume after browser reload.

~~~bash
git add apps/api apps/studio && git commit -m "feat: add single-user workflow studio"
~~~

### Task 9: Add observability, cost records, and deterministic pilot fixtures

**Files:**
- Create: packages/orchestration/src/{telemetry.ts,cost.ts}
- Create: packages/test-kit/src/pilots/{rome-ja.ts,pompeii-ja.ts,pyramids-ja.ts}
- Create: workers/workflow/test/e2e-pilots.test.ts, docs/pilots.md

**Interfaces:**
- Produces StageTelemetry, CostRecord, and three offline pilot configurations.
- runPilot() produces a PublishingPackage and trace from final render to sources.

- [ ] **Step 1: Write cost aggregation test and implement telemetry.**

~~~ts
expect(sumProjectCost([{amountUsd:0.2},{amountUsd:0.18}])).toBe(0.38);
~~~

Record queue delay, duration, retry reason, provider/model, units, cost, project, execution, and child artifact IDs.

- [ ] **Step 2: Write pilot lineage test and implement fixtures.**

~~~ts
const result = await runPilot(createRomeJapanesePilot());
expect(result.finalArtifact.kind).toBe("PublishingPackage");
expect(result.traceFromRenderToSources.length).toBeGreaterThan(0);
~~~

Create Japanese Rome-fall, Pompeii-disappearance, and pyramid-construction fixture projects using fake providers.

- [ ] **Step 3: Verify full CI quality gate and commit.**

Run: pnpm test && pnpm lint && pnpm typecheck  
Expected: all pilot artifact graphs are lineage-complete and report no QA blocker.

~~~bash
git add packages/orchestration packages/test-kit workers/workflow docs/pilots.md && git commit -m "test: add cross-domain localized pilot workflows"
~~~

### Task 10: Run credentialed acceptance and document operations

**Files:**
- Create: scripts/{run-pilot.ts,verify-render.ts}, docs/{operations.md,provider-setup.md,quality-rubric.md,runbook.md}
- Modify: README.md, .env.example
- Test: scripts/verify-render.test.ts

**Interfaces:**
- Produces operator commands to run/retry/resume/review a project and validate a final MP4.
- Consumes OPENAI_API_KEY, ELEVENLABS_API_KEY, database, Redis, storage, and configured voice variables.

- [ ] **Step 1: Write failing render-verifier test.**

~~~ts
await expect(verifyRender("fixtures/no-audio.mp4")).rejects.toThrow("Missing audio stream");
~~~

Run: pnpm tsx scripts/verify-render.test.ts  
Expected: FAIL because verifier is absent.

- [ ] **Step 2: Implement scripts and runbook.**

run-pilot accepts rome-ja, pompeii-ja, or pyramids-ja. verify-render fails unless video/audio streams, 1080x1920, 30 fps, and nonzero duration are present. Document targeted image/audio regeneration and resume.

- [ ] **Step 3: Run three independent credentialed pilots.**

Run: pnpm tsx scripts/run-pilot.ts --pilot rome-ja  
Expected: reviewable MP4, source-linked graph, variants, clips, subtitles, QA, and publishing package.

Repeat for pompeii-ja and pyramids-ja. In Rome, regenerate one image and one narration clip; verify unrelated approved media IDs remain unchanged.

- [ ] **Step 4: Verify and commit release material.**

Run: pnpm test && pnpm lint && pnpm typecheck && pnpm tsx scripts/verify-render.ts out/rome-ja.mp4  
Expected: all checks pass and verifier prints expected streams, dimensions, fps, and duration.

~~~bash
git add docs scripts README.md .env.example && git commit -m "docs: add production runbook and pilot acceptance"
~~~

## Plan Self-Review

- **Coverage:** Tasks 1–3 implement foundation, immutable state, and 15-stage orchestration. Task 4 implements research through storyboard. Tasks 5 and 6 implement the image and TTS subsystems. Task 7 implements layered production and QA. Task 8 implements the single-user React Flow Studio. Tasks 9–10 provide observability, pilots, and operational acceptance.
- **No placeholders:** Every task supplies exact paths, inputs/outputs, test behavior, commands, and a commit boundary.
- **Type consistency:** Artifact contracts precede orchestration; SceneSpec precedes asset/audio/render; provider interfaces precede stage handlers; CompositionPackage precedes Studio artifact previews.

