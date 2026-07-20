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
- Character identity, prompt templates, and style profiles are explicit versioned contracts; image reuse requires an exact deterministic generation fingerprint.

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
  research/src/{provider.ts,facts.ts,verification.ts}
  editorial/src/{provider.ts,angle.ts,localization.ts,script.ts,characters.ts,storyboard.ts}
  prompts/src/{template.ts,registry.ts,index.ts}
  styles/src/{profile.ts,presets.ts,index.ts}
  assets/src/{provider.ts,service.ts,processing.ts,qa.ts,library.ts,cache.ts}
  audio/src/{provider.ts,normalization.ts,pronunciation.ts,timing.ts,qa.ts}
  rendering/src/{composition.ts,render.ts,qa.ts}
  storage/src/{artifact-store.ts,s3-store.ts}
  test-kit/src/{fakes.ts,fixtures.ts}
infra/{docker-compose.yml,init-minio.sh}
~~~

---

### Task 1: Create the monorepo and local services

**Files:**
- Create: package.json, pnpm-workspace.yaml, tsconfig.base.json, .nvmrc, .env.example, .gitignore
- Create: infra/docker-compose.yml, infra/init-minio.sh, .github/workflows/ci.yml
- Create: packages/test-kit/src/fakes.ts, packages/test-kit/test/fakes.test.ts
- Create: README.md

**Interfaces:**
- Produces workspace commands dev, test, lint, typecheck, infra:up, and infra:down.
- Produces createMemoryArtifactStore() for unit tests.

- [ ] **Step 1: Initialize Git and workspace configuration.**

~~~json
{"name":"knowledge-story-video-factory","private":true,"packageManager":"pnpm@9.15.0","engines":{"node":"22.x","pnpm":"9.15.0"},"scripts":{"test":"pnpm -r test","lint":"pnpm -r lint","typecheck":"pnpm -r typecheck","infra:up":"docker compose -f infra/docker-compose.yml up -d","infra:down":"docker compose -f infra/docker-compose.yml down"}}
~~~

~~~dotenv
OPENAI_API_KEY=
OPENAI_RESEARCH_MODEL=
OPENAI_EDITORIAL_MODEL=
OPENAI_IMAGE_MODEL=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
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

Set `.nvmrc` to `22`. Configure GitHub Actions with `actions/setup-node` `node-version: 22` and `cache: pnpm`. Configure PostgreSQL 16, Redis 7, and MinIO in Docker Compose.

- [ ] **Step 4: Verify and commit.**

Run: pnpm test && pnpm lint && pnpm typecheck && pnpm infra:up  
Expected: tests pass and all containers are healthy.

~~~bash
git add . && git commit -m "chore: initialize video factory"
~~~

### Task 2: Add versioned schemas, database, and artifact storage

**Files:**
- Create: packages/schemas/src/{artifact.ts,project.ts,workflow.ts,content.ts,media.ts,index.ts}
- Create: packages/prompts/src/{template.ts,registry.ts,index.ts}
- Create: packages/styles/src/{profile.ts,presets.ts,index.ts}
- Create: packages/db/src/{client.ts,schema.ts,repositories/artifacts.ts,repositories/projects.ts,index.ts}
- Create: packages/storage/src/{artifact-store.ts,s3-store.ts,index.ts}
- Test: packages/schemas/test/{artifact.test.ts,content.test.ts}, packages/prompts/test/registry.test.ts, packages/styles/test/profile.test.ts, packages/db/test/artifacts.test.ts

**Interfaces:**
- Produces ArtifactSchema, ProjectConfigSchema, WorkflowStageSchema, CharacterProfileSchema, CharacterRegistrySchema, PromptTemplateSchema, StyleProfileSchema, and ArtifactRepository.createVersion().
- ArtifactRepository.traceInputs(id) returns all transitive source artifact IDs.
- PromptTemplateRegistry resolves an immutable `{id, version}` reference; the MVP seeds StyleProfile `{id:"paper-collage", version:1}`.

- [ ] **Step 1: Write failing schema tests.**

~~~ts
expect(() => ArtifactSchema.parse({kind: "script"})).toThrow();
expect(ArtifactSchema.parse({id:"art_1",projectId:"prj_1",kind:"LocalizedScript",version:2,status:"ready",inputArtifactIds:["art_0"],payload:{},createdAt:"2026-07-19T00:00:00.000Z",createdBy:"worker"}).version).toBe(2);
expect(PromptTemplateSchema.parse({id:"storyboard-director",version:1,domain:"storyboard",systemTemplate:"...",userTemplate:"...",outputSchemaVersion:"1",modelDefaults:{},createdAt:"2026-07-19T00:00:00.000Z"}).version).toBe(1);
expect(StyleProfileSchema.parse({id:"paper-collage",version:1,name:"Paper Collage",visualLanguage:"layered paper cut",lineTreatment:"paper outline",texture:"paper grain",lighting:"soft cinematic",palette:["#111111"],characterProportions:"editorial illustration",imagePromptPrefix:"paper collage",imagePromptSuffix:"clean separated layers",negativePrompt:["text"],motionPresetSet:"paper-v1",typographyPreset:"documentary-v1",transitionPresetSet:"paper-v1"}).id).toBe("paper-collage");
~~~

Run: pnpm --filter @ksvf/schemas test && pnpm --filter @ksvf/prompts test && pnpm --filter @ksvf/styles test
Expected: FAIL because schemas and registries do not exist.

- [ ] **Step 2: Implement artifact and project contracts.**

~~~ts
export const ArtifactSchema = z.object({
  id:z.string().min(1), projectId:z.string().min(1), kind:z.string().min(1),
  version:z.number().int().positive(), status:z.enum(["draft","ready","approved","rejected"]),
  inputArtifactIds:z.array(z.string()), payload:z.unknown(), createdAt:z.string().datetime(),
  createdBy:z.enum(["user","worker"])
});
~~~

Add these versioned contracts:

~~~ts
export const CharacterProfileSchema = z.object({
 id:z.string(), name:z.string(), aliases:z.array(z.string()),
 appearance:z.object({face:z.string(),hair:z.string(),ageRange:z.string().optional(),bodyType:z.string().optional(),distinctiveTraits:z.array(z.string())}),
 costumes:z.array(z.object({id:z.string(),period:z.string(),description:z.string(),referenceAssetIds:z.array(z.string())})),
 canonicalReferenceAssetIds:z.array(z.string()), promptAnchors:z.array(z.string()), negativeAnchors:z.array(z.string()),
 voiceProfileId:z.string().optional(), cultureTags:z.array(z.string()), periodTags:z.array(z.string())
});
export const CharacterRegistrySchema = z.object({projectId:z.string(),characters:z.array(CharacterProfileSchema)});
export const PromptTemplateSchema = z.object({
 id:z.string(),version:z.number().int().positive(),domain:z.enum(["research","fact-check","editorial-angle","localization","script","storyboard","image","review"]),
 systemTemplate:z.string(),userTemplate:z.string(),outputSchemaVersion:z.string(),modelDefaults:z.record(z.unknown()),createdAt:z.string().datetime()
});
export const StyleProfileSchema = z.object({
 id:z.string(),version:z.number().int().positive(),name:z.string(),visualLanguage:z.string(),lineTreatment:z.string(),texture:z.string(),lighting:z.string(),palette:z.array(z.string()),characterProportions:z.string(),
 imagePromptPrefix:z.string(),imagePromptSuffix:z.string(),negativePrompt:z.array(z.string()),motionPresetSet:z.string(),typographyPreset:z.string(),transitionPresetSet:z.string()
});
~~~

Project configuration must contain contentDomain, topic, storyFormat, audience, presentation, truthPolicy, and an immutable `styleProfileRef: {id, version}`.

- [ ] **Step 3: Write repository lineage test, implement Drizzle tables, then verify.**

~~~ts
const fact = await repository.createVersion("prj_1","FactPackage",[],{facts:[]});
const script = await repository.createVersion("prj_1","LocalizedScript",[fact.id],{scenes:[]});
expect(await repository.traceInputs(script.id)).toContain(fact.id);
~~~

Create projects, artifacts, artifact_inputs, workflow_runs, stage_executions, asset_jobs, audio_jobs, prompt_templates, and style_profiles tables. Enforce increasing project-kind versions and unique `(id, version)` prompt/style records. Seed StyleProfile `{id:"paper-collage", version:1}`; store CharacterRegistry as a normal immutable artifact so it remains project-scoped in the MVP.

Run: pnpm --filter @ksvf/schemas test && pnpm --filter @ksvf/prompts test && pnpm --filter @ksvf/styles test && pnpm --filter @ksvf/db test
Expected: schema, registry, style-profile, and lineage tests pass.

- [ ] **Step 4: Commit.**

~~~bash
git add packages/schemas packages/prompts packages/styles packages/db packages/storage && git commit -m "feat: add versioned artifact persistence"
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
- Create: packages/research/src/provider.ts
- Create: packages/editorial/src/{provider.ts,angle.ts,localization.ts,script.ts,characters.ts,storyboard.ts,index.ts}
- Test: packages/research/test/{provider.test.ts,verification.test.ts}, packages/editorial/test/{provider.test.ts,characters.test.ts,storyboard.test.ts}

**Interfaces:**
- Produces FactPackage, Claim, VerificationReport, LocalizedScript, CharacterRegistry, and DirectorStoryboard artifacts.
- SceneSpec is consumed by asset, audio, and rendering packages.
- Produces ResearchProvider.search() and LanguageModelProvider.generateStructured(); domain services only receive provider interfaces.
- Every LLM call resolves an immutable PromptTemplate reference and every storyboard resolves the project StyleProfile reference.

- [ ] **Step 1: Write failing provider-boundary and source traceability tests.**

~~~ts
const sources = await researchProvider.search({query:"fall of Rome",language:"en",limit:3});
expect(sources[0]).toMatchObject({id:"src_1",title:expect.any(String),url:expect.stringMatching(/^https:\/\//),retrievedAt:expect.any(String)});
const script = await languageModel.generateStructured({model:"editorial-model",schema:LocalizedScriptSchema,promptTemplateRef:{id:"localized-script",version:1},language:"ja-JP",system:"",user:""});
expect(script.language).toBe("ja-JP");
expect(verifyClaims({claims:[{id:"c1",sourceIds:[]}]}).blockingIssues)
  .toContainEqual({claimId:"c1",code:"MISSING_SOURCE"});
~~~

Run: pnpm --filter @ksvf/research test  
Expected: FAIL because provider contracts and verification are absent.

- [ ] **Step 2: Implement provider contracts, MVP adapters, and fakes.**

~~~ts
export type ResearchSource = {id:string;providerSourceId:string;title:string;url:string;excerpt:string;publishedAt?:string;retrievedAt:string};
export interface ResearchProvider {
 search(input:{query:string;language:string;limit:number}): Promise<ResearchSource[]>;
}
export type StructuredPrompt<T> = {model:string;schema:z.ZodType<T>;promptTemplateRef:{id:string;version:number};language:string;system:string;user:string};
export interface LanguageModelProvider {
 generateStructured<T>(input:StructuredPrompt<T>): Promise<T>;
}
~~~

Implement `OpenAiWebSearchResearchProvider` in `packages/research/src/provider.ts` and `OpenAiLanguageModelProvider` in `packages/editorial/src/provider.ts`. Configure required `OPENAI_RESEARCH_MODEL` and `OPENAI_EDITORIAL_MODEL`; resolve PromptTemplate content from `PromptTemplateRegistry` and persist provider, model, `{promptTemplateId, promptTemplateVersion}`, source IDs, source retrieval time, and `{styleProfileId, styleProfileVersion}` where visual output is derived. Implement `FakeResearchProvider` and `FakeLanguageModelProvider` in test-kit. No research, verification, editorial, script, or storyboard module imports an OpenAI SDK directly.

- [ ] **Step 3: Implement truth-policy verification.**

Require sources for factual claims; label interpretive, legendary, speculative, and fictional-alt-history claims. Reject alternate-history projects without fictional disclosure metadata.

- [ ] **Step 4: Build the project CharacterRegistry without adding a workflow stage.**

~~~ts
const registry = buildCharacterRegistry({script,existingRegistry:undefined});
expect(registry.characters).toEqual(expect.arrayContaining([
 expect.objectContaining({name:"Julius Caesar",canonicalReferenceAssetIds:[],promptAnchors:expect.any(Array)})
]));
const reused = buildCharacterRegistry({script:nextScript,existingRegistry:registry});
expect(reused.characters.find((item) => item.name === "Julius Caesar")?.id)
 .toBe(registry.characters.find((item) => item.name === "Julius Caesar")?.id);
~~~

Create or update one immutable `CharacterRegistry` artifact inside the Storyboard stage. Preserve stable character IDs, aliases, appearance anchors, costume variants, canonical references, negative anchors, and optional voice profile. Storyboard primary/secondary character layers reference `characterId`; Asset Planning merges CharacterProfile prompt anchors and canonical reference assets into generation requests. The optional Character Reference gate approves only canonical references, not every scene asset.

- [ ] **Step 5: Write failing director scene test and implement SceneSpec.**

~~~ts
const layer = {
 id:"scene-01-primary", role:"primary", subject:"Julius Caesar", characterId:"character-caesar",
 assetType:"generated-image",
 generation:{promptIntent:"Roman leader, paper-cut portrait",transparentBackground:true,referenceAssetIds:[]},
 layout:{anchorX:0.5,anchorY:0.62,widthPercent:44,scale:1,rotation:-2,zIndex:5},
 motion:{preset:"primary-entrance",startFrame:6,intensity:0.7}
};
const scene = {
 id:"scene-01", narrativeBeat:"Caesar enters the Senate", primarySubject:"Julius Caesar",
 layers:[{...layer,id:"scene-01-background",role:"background",subject:"Roman Senate",generation:{promptIntent:"Roman Senate interior",transparentBackground:false,referenceAssetIds:[]},layout:{...layer.layout,zIndex:0}},layer],
 camera:{preset:"push-in",direction:"center",startScale:1,endScale:1.08,startX:0,endX:-40,startY:0,endY:15,easing:"ease-in-out"},
 subtitleSafeArea:{edge:"bottom",insetPercent:18}
};
expect(SceneSpecSchema.parse(scene)).toBeTruthy();
expect(() => SceneSpecSchema.parse({...scene,layers:[...scene.layers,{...layer,id:"scene-01-duplicate",layout:{...layer.layout,zIndex:5}}]})).toThrow("duplicate z-index");
expect(() => SceneSpecSchema.parse({...scene,layers:[scene.layers[0],{...scene.layers[0],id:"scene-01-secondary",role:"secondary",layout:{...scene.layers[0].layout,zIndex:3}}]})).toThrow("scene requires a primary layer");
expect(() => SceneSpecSchema.parse({id:"scene-01",narrationClipId:"n1"})).toThrow();
~~~

~~~ts
export const CameraPlanSchema = z.object({
 preset:z.enum(["static","push-in","pull-out","pan","orbit-simulated"]),
 direction:z.enum(["left","right","up","down","center"]),
 startScale:z.number().positive(), endScale:z.number().positive(),
 startX:z.number(), endX:z.number(), startY:z.number(), endY:z.number(),
 easing:z.enum(["linear","ease-in-out"])
});

export const SceneLayerSchema = z.object({
 id:z.string().min(1),
 role:z.enum(["background","tertiary","secondary","primary","foreground","effect","overlay"]),
 subject:z.string().min(1),
 characterId:z.string().optional(),
 assetType:z.enum(["generated-image","library-image","svg","text","particle"]),
 assetId:z.string().optional(),
 generation:z.object({
   promptIntent:z.string().min(1), transparentBackground:z.boolean(), referenceAssetIds:z.array(z.string())
 }).optional(),
 layout:z.object({
   anchorX:z.number().min(0).max(1), anchorY:z.number().min(0).max(1),
   widthPercent:z.number().positive().max(100), scale:z.number().positive(), rotation:z.number(), zIndex:z.number().int()
 }),
 motion:z.object({
   preset:z.enum(["static","background-parallax","slow-drift","primary-entrance","paper-pop","foreground-sweep","subtle-breathing"]),
   startFrame:z.number().int().nonnegative(), endFrame:z.number().int().nonnegative().optional(), intensity:z.number().min(0).max(1)
 })
}).superRefine((layer, context) => {
 const providerLayer = layer.assetType === "generated-image";
 if (providerLayer && !layer.generation) context.addIssue({code:z.ZodIssueCode.custom,message:"generated-image requires generation"});
 if (!providerLayer && layer.generation) context.addIssue({code:z.ZodIssueCode.custom,message:"only generated-image may have generation"});
 if (layer.assetType === "library-image" && !layer.assetId) context.addIssue({code:z.ZodIssueCode.custom,message:"library-image requires assetId"});
 if (layer.motion.endFrame !== undefined && layer.motion.endFrame < layer.motion.startFrame) context.addIssue({code:z.ZodIssueCode.custom,message:"motion endFrame precedes startFrame"});
});

export const SceneSpecSchema = z.object({
 id:z.string(), narrativeBeat:z.string(), primarySubject:z.string(),
 layers:z.array(SceneLayerSchema).min(2), camera:CameraPlanSchema,
 subtitleSafeArea:z.object({edge:z.literal("bottom"),insetPercent:z.literal(18)})
}).superRefine((scene, context) => {
 const layerIds = new Set<string>();
 const zIndexes = new Set<number>();
 if (!scene.layers.some((layer) => layer.role === "primary")) context.addIssue({code:z.ZodIssueCode.custom,path:["layers"],message:"scene requires a primary layer"});
 scene.layers.forEach((layer, index) => {
  if (layerIds.has(layer.id)) context.addIssue({code:z.ZodIssueCode.custom,path:["layers",index,"id"],message:"duplicate layer id"});
  if (zIndexes.has(layer.layout.zIndex)) context.addIssue({code:z.ZodIssueCode.custom,path:["layers",index,"layout","zIndex"],message:"duplicate z-index"});
  layerIds.add(layer.id);
  zIndexes.add(layer.layout.zIndex);
 });
});
~~~

The DirectorStoryboard artifact stores the immutable project `styleProfileRef`; character layers store `characterId`. `SceneLayer.id` is stable within the storyboard artifact. It is required link key for Asset Planning and Composition. Require at least one primary layer plus unique layer IDs and z-indexes per scene. Do not add scene-level role-motion defaults: storyboard layer and camera parameters are rendering intent.

Target-language authors write directly for the market. Japanese scripts require pronunciation entries for ambiguous proper nouns.

- [ ] **Step 6: Verify and commit.**

Run: pnpm --filter @ksvf/research test && pnpm --filter @ksvf/editorial test  
Expected: unsourced claims, incomplete scenes, missing primary layers, unstable character identities, generated layers without prompts, and invalid provider/template artifacts are rejected.

~~~bash
git add packages/research packages/editorial && git commit -m "feat: add verified localized story packages"
~~~

### Task 5: Implement image assets, processing, QA, library, and continuity

**Files:**
- Create: packages/assets/src/{provider.ts,service.ts,processing.ts,qa.ts,library.ts,cache.ts,types.ts,index.ts}
- Create: workers/workflow/src/stage-handlers/image-generation.ts
- Test: packages/assets/test/{service.test.ts,processing.test.ts,qa.test.ts,cache.test.ts}

**Interfaces:**
- Produces ImageGenerationProvider.generate(), AssetService.generateAsset(), AssetVariant, and approved Asset artifacts.
- Produces planAssetsFromStoryboard(), computeAssetCacheKey(), AssetManifest, and ResolvedStoryboard artifacts.
- The configured adapter is OpenAiImageProvider; tests use FakeImageProvider.
- Exact cache reuse is keyed by prompt, references, provider/model parameters, StyleProfile version, aspect ratio, and alpha requirement.

- [ ] **Step 1: Write failing asset lifecycle test.**

~~~ts
const transparentForeground = {
 ...storyboard.scenes[0].layers[0],id:"scene-01-foreground",role:"foreground",
 generation:{promptIntent:"falling ash foreground",transparentBackground:true,referenceAssetIds:[]},
 layout:{...storyboard.scenes[0].layers[0].layout,zIndex:7}
};
const jobs = planAssetsFromStoryboard({...storyboard,scenes:[{
 ...storyboard.scenes[0],layers:[...storyboard.scenes[0].layers,transparentForeground]
}]});
expect(jobs).toEqual(expect.arrayContaining([
 expect.objectContaining({sceneId:"scene-01",layerId:"scene-01-primary",assetType:"generated-image",alphaRequired:true})
]));
expect(jobs.find((job) => job.layerId === "scene-01-background")).toMatchObject({alphaRequired:false});
expect(jobs.find((job) => job.layerId === "scene-01-foreground")).toMatchObject({alphaRequired:true});
expect(jobs.some((job) => job.assetType === "particle")).toBe(false);
const asset = await service.plan({assetId:"asset-scene-03-character-01",layerId:"scene-03-primary",type:"character",sceneId:"scene-03",alphaRequired:true});
expect(asset.status).toBe("PLANNED");
await service.preparePrompt(asset.assetId,{prompt:"portrait",negativePrompt:"text, watermark"});
expect((await service.get(asset.assetId)).status).toBe("PROMPT_READY");
const fingerprint = {normalizedPrompt:"portrait",negativePrompt:"text, watermark",referenceAssetHashes:["ref-a"],provider:"openai",model:"image-model",modelParameters:{quality:"high"},styleProfileRef:{id:"paper-collage",version:1},aspectRatio:"9:16",alphaRequired:true};
expect(computeAssetCacheKey(fingerprint)).toBe(computeAssetCacheKey({...fingerprint,modelParameters:{quality:"high"}}));
expect(computeAssetCacheKey({...fingerprint,styleProfileRef:{id:"paper-collage",version:2}})).not.toBe(computeAssetCacheKey(fingerprint));
~~~

Run: pnpm --filter @ksvf/assets test  
Expected: FAIL because AssetService is absent.

- [ ] **Step 2: Implement provider and lifecycle.**

~~~ts
export interface ImageGenerationProvider { generate(input: ImageGenerationInput): Promise<ImageGenerationResult>; }
export type AssetStatus = "PLANNED"|"PROMPT_READY"|"GENERATING"|"GENERATED"|"PROCESSING"|"VALIDATING"|"APPROVED"|"FAILED";
export type AssetGenerationFingerprint = {normalizedPrompt:string;negativePrompt:string;referenceAssetHashes:string[];provider:string;model:string;modelParameters:Record<string,unknown>;styleProfileRef:{id:string;version:number};aspectRatio:string;alphaRequired:boolean};
export type AssetJob = {assetId:string;sceneId:string;layerId:string;assetType:"generated-image"|"library-image";alphaRequired:boolean;cacheKey?:string};
export type ResolvedStoryboard = {storyboardArtifactId:string;layers:Array<{sceneId:string;layerId:string;approvedAssetId:string}>};
~~~

`planAssetsFromStoryboard()` emits one AssetJob for every `generated-image` or `library-image` layer and no jobs for SVG, text, or particle layers. For every generated-image layer, set `alphaRequired` exactly to `layer.generation.transparentBackground`; never infer it from role. Resolve image PromptTemplate and StyleProfile versions, merge CharacterProfile anchors/references when `characterId` is present, then build a canonical `AssetGenerationFingerprint` and SHA-256 cache key using stable JSON serialization. Persist `sceneId`, `layerId`, prompt-template reference, normalized prompt, negative prompt, references and their content hashes, provider/model parameters, style-profile reference, ratio, alpha requirement, period/culture metadata, cache key, all variants, and selected variant. Before calling the provider, reuse only an approved asset with the exact cache key and compatible usage rights; tag similarity alone is not a cache hit. When each required job is approved, create a new `ResolvedStoryboard` artifact containing its approved asset binding; never mutate the approved Storyboard.

- [ ] **Step 3: Write failing alpha QA test, implement Sharp processing, and test reuse.**

~~~ts
const report = await inspectAsset(fixture("transparent-character.png"));
expect(report).toMatchObject({hasAlpha:true,width:2048,issues:[]});
~~~

Preserve originals, trim transparent bounds, normalize canvas, create thumbnail, and reject insufficient resolution, missing alpha, or clipped subject. Permit semantic library discovery by culture, period, character, and style tags, but automatically reuse generation output only on an exact cache-key match.

- [ ] **Step 4: Verify targeted regenerate and commit.**

Run: pnpm --filter @ksvf/assets test  
Expected: failed variant regenerates without changing approved sibling variants; every generated storyboard layer has a traceable job and approved binding; identical generation fingerprints reuse the approved asset while any prompt, reference, model, style-version, ratio, or alpha change produces a cache miss.

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
- Only buildComposition() converts ResolvedStoryboard, approved assets, audio, and subtitles into renderer input.

- [ ] **Step 1: Write failing layer-resolution and motion-intent tests.**

~~~ts
const composition = buildComposition({scene,resolvedStoryboard,approvedAssets,narration,subtitles});
expect(composition.layers).toEqual(expect.arrayContaining([
 expect.objectContaining({id:"scene-01-primary",assetId:"asset-caesar",zIndex:5,motion:{preset:"primary-entrance",startFrame:6,intensity:0.7}})
]));
expect(composition.camera).toMatchObject({preset:"push-in",startScale:1,endScale:1.08,endX:-40,endY:15});
const sceneTwo = {...scene,id:"scene-02",layers:scene.layers.map((layer) => ({
 ...layer,id:layer.id.replace("scene-01","scene-02"),
 motion:layer.role === "primary" ? {...layer.motion,preset:"subtle-breathing"} : layer.motion
}))};
const resolvedStoryboardTwo = {...resolvedStoryboard,layers:resolvedStoryboard.layers.map((binding) => ({
 ...binding,sceneId:"scene-02",layerId:binding.layerId.replace("scene-01","scene-02")
}))};
expect(buildComposition({scene:sceneTwo,resolvedStoryboard:resolvedStoryboardTwo,approvedAssets,narration,subtitles}).layers.find((layer) => layer.role === "primary")?.motion.preset).toBe("subtle-breathing");
expect(() => buildComposition({scene,resolvedStoryboard:{...resolvedStoryboard,layers:[]},approvedAssets,narration,subtitles})).toThrow("missing approved asset binding");
~~~

Run: pnpm --filter @ksvf/rendering test  
Expected: FAIL because composition builder is absent.

- [ ] **Step 2: Implement composition contract and layer-specific motion.**

~~~ts
export type CompositionLayer = {
 id:string; role:SceneLayer["role"]; assetId?:string; layout:SceneLayer["layout"]; motion:SceneLayer["motion"];
};
export type CompositionPackage = {scenes:Array<{id:string;camera:CameraPlan;layers:CompositionLayer[]}>};
~~~

Join approved assets by `sceneId` plus `layerId`; reject missing, rejected, wrong-alpha, or unused bindings. Pass each layer's stored `layout` and `motion` unchanged into Remotion. `LayeredScene` executes motion presets and scene camera values, not role-selected hard-coded motion. Use independent layers, explicit z-index, paper outline/shadow, and bottom-18% subtitle safe area. Render smoke, snow, dust, embers, paper grain, ink wipe, arrows, timeline, map route, and labels through local SVG/CSS/particle components; never create image-provider jobs for them.

- [ ] **Step 3: Write render-config test, implement renderer, and verify media.**

~~~ts
expect(createRenderConfig()).toMatchObject({width:1080,height:1920,fps:30,codec:"h264"});
~~~

Render with Remotion. Use ffprobe to require one video and one audio stream, 1080x1920, 30 fps, and nonzero duration. Reject subtitle-primary overlap, scenes without a primary layer, unresolved generated/library layers, duplicate z-index, and invalid layer motion frame ranges.

- [ ] **Step 4: Verify fixture render and commit.**

Run: pnpm --filter @ksvf/rendering test && pnpm --filter @ksvf/remotion render:fixture  
Expected: fixture MP4 passes technical and creative QA, with independently animated camera and scene layers rather than a flattened-image zoom.

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
expect(result.artifacts).toEqual(expect.arrayContaining([
 expect.objectContaining({kind:"CharacterRegistry"}),
 expect.objectContaining({metadata:expect.objectContaining({promptTemplateId:expect.any(String),promptTemplateVersion:expect.any(Number)})}),
 expect.objectContaining({metadata:expect.objectContaining({styleProfileId:"paper-collage",styleProfileVersion:1})})
]));
expect(result.telemetry.assetCacheHits).toBeGreaterThan(0);
~~~

Create Japanese Rome-fall, Pompeii-disappearance, and pyramid-construction fixture projects using fake providers. Each fixture includes immutable PromptTemplate references, StyleProfile `{id:"paper-collage",version:1}`, a project CharacterRegistry for recurring people, and at least one duplicated generation fingerprint that must resolve through the asset cache without a second fake-provider call.

- [ ] **Step 3: Verify full CI quality gate and commit.**

Run: pnpm test && pnpm lint && pnpm typecheck  
Expected: all pilot artifact graphs are lineage-complete, character identities remain stable across scenes, prompt/style provenance is present, exact cache reuse is observed, and no QA blocker is reported.

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

Repeat for pompeii-ja and pyramids-ja. In Rome, request one identical approved image again and verify telemetry records a cache hit with no extra image-provider invocation; then change its prompt or StyleProfile version and verify a cache miss creates a new asset. Regenerate one narration clip and verify unrelated approved media IDs remain unchanged. Confirm recurring character layers retain the same CharacterProfile ID and canonical references.

- [ ] **Step 4: Verify and commit release material.**

Run: pnpm test && pnpm lint && pnpm typecheck && pnpm tsx scripts/verify-render.ts out/rome-ja.mp4  
Expected: all checks pass and verifier prints expected streams, dimensions, fps, and duration.

~~~bash
git add docs scripts README.md .env.example && git commit -m "docs: add production runbook and pilot acceptance"
~~~

## Plan Self-Review

- **Coverage:** Tasks 1–3 implement foundation, immutable state, prompt/style registries, and 15-stage orchestration. Task 4 implements research through storyboard plus a project-scoped CharacterRegistry. Tasks 5 and 6 implement exact asset-cache reuse, image generation, and TTS. Task 7 implements layered production and QA. Task 8 implements the single-user React Flow Studio. Tasks 9–10 provide observability, pilots, and operational acceptance.
- **No placeholders:** Every task supplies exact paths, inputs/outputs, test behavior, commands, and a commit boundary.
- **Type consistency:** PromptTemplate and StyleProfile references precede every derived AI/media artifact; CharacterProfile IDs and reference assets precede character layers; `SceneLayer.id` precedes AssetJob.layerId; exact AssetGenerationFingerprint hashes precede provider calls; AssetManifest and ApprovedAsset bindings produce an immutable ResolvedStoryboard; CompositionPackage consumes its resolved layers. Camera and motion intent originate in SceneSpec and are executed, not invented, by Remotion.
