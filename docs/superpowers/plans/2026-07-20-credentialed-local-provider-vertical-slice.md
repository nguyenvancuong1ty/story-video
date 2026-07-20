# Credentialed Local-Provider Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run `rome-ja --credentialed` through local LLM, OpenRouter image generation, CapCut TTS, Remotion rendering, and technical QA to produce a real vertical MP4 and publishing package.

**Architecture:** Keep offline `runPilot()` unchanged. Add small provider adapters at existing domain-package boundaries, then add a real-provider runner that makes six short Rome scenes, creates no more than six cache-miss images, persists media under `out/rome-ja/`, and invokes Remotion with explicit composition props. This runner proves the vertical slice and does not yet replace the API's in-memory workflow projection.

**Tech Stack:** Node.js 22, pnpm 9, TypeScript, Vitest, Zod, native `fetch`, OpenAI-compatible chat completions, OpenRouter Image API, local CapCut Web TTS, Remotion CLI, FFprobe.

## Global Constraints

- `LOCAL_LLM_BASE_URL` defaults to `http://localhost:20128/v1`; `LOCAL_LLM_MODEL` defaults to `cx/gpt-5.6-terra`.
- OpenRouter calls use `POST https://openrouter.ai/api/v1/images`, `n: 1`, and base64 image responses.
- `OPENROUTER_API_KEY` and `OPENROUTER_IMAGE_MODEL` are required only for credentialed runs and must never be logged.
- `CAPCUT_TTS_BASE_URL` defaults to `http://127.0.0.1:8765`; `CAPCUT_TTS_VOICE_INDEX` defaults to `25`; CapCut MP3 is obtained via `POST /api/tts/raw`.
- A project may create at most ten cache-miss images. Cache hits consume no image budget.
- The Rome slice has six 10-second scenes, uses no more than six new images, and renders 1080x1920 H.264 at 30 fps with audio.
- Offline fixture tests remain credential-free and must continue to pass.
- Run live acceptance only after the user supplies `OPENROUTER_API_KEY`, `OPENROUTER_IMAGE_MODEL`, and starts the CapCut service.

---

### Task 1: Add safe runtime configuration and provider preflight

**Files:**
- Create: `packages/test-kit/src/credentialed/config.ts`
- Create: `packages/test-kit/test/credentialed-config.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces `loadCredentialedConfig(env): CredentialedConfig`.
- Produces `assertCredentialedPreflight(config, fetcher): Promise<void>`.
- `CredentialedConfig` includes provider URLs, model/voice selections, and `maxGeneratedImages`; errors must not include secret values.

- [ ] **Step 1: Write the failing configuration tests.**

~~~ts
import { expect, it } from "vitest";
import { loadCredentialedConfig } from "../src/credentialed/config.js";

it("uses the approved local-provider defaults", () => {
  expect(loadCredentialedConfig({ OPENROUTER_API_KEY: "key", OPENROUTER_IMAGE_MODEL: "model" }))
    .toMatchObject({ localLlmBaseUrl: "http://localhost:20128/v1", localLlmModel: "cx/gpt-5.6-terra", capcutTtsBaseUrl: "http://127.0.0.1:8765", capcutTtsVoiceIndex: 25, maxGeneratedImages: 10 });
});

it("reports missing image configuration without exposing a value", () => {
  expect(() => loadCredentialedConfig({ OPENROUTER_API_KEY: "secret" })).toThrow("OPENROUTER_IMAGE_MODEL is required");
});
~~~

- [ ] **Step 2: Run the test to verify it fails.**

Run: `pnpm --filter @ksvf/test-kit test -- credentialed-config.test.ts`

Expected: FAIL because `credentialed/config.ts` does not exist.

- [ ] **Step 3: Write the minimal implementation.**

~~~ts
export type CredentialedConfig = {
  localLlmBaseUrl: string; localLlmModel: string; openRouterApiKey: string; openRouterImageBaseUrl: string;
  openRouterImageModel: string; capcutTtsBaseUrl: string; capcutTtsVoiceIndex: number; capcutTtsRate: string; maxGeneratedImages: number;
};

export const loadCredentialedConfig = (env: NodeJS.ProcessEnv): CredentialedConfig => {
  const required = (name: "OPENROUTER_API_KEY" | "OPENROUTER_IMAGE_MODEL") => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} is required for --credentialed`);
    return value;
  };
  const maxGeneratedImages = Number(env.MAX_GENERATED_IMAGES_PER_PROJECT ?? "10");
  if (!Number.isInteger(maxGeneratedImages) || maxGeneratedImages < 1 || maxGeneratedImages > 10) throw new Error("MAX_GENERATED_IMAGES_PER_PROJECT must be an integer from 1 to 10");
  return { localLlmBaseUrl: env.LOCAL_LLM_BASE_URL ?? "http://localhost:20128/v1", localLlmModel: env.LOCAL_LLM_MODEL ?? "cx/gpt-5.6-terra", openRouterApiKey: required("OPENROUTER_API_KEY"), openRouterImageBaseUrl: env.OPENROUTER_IMAGE_BASE_URL ?? "https://openrouter.ai/api/v1", openRouterImageModel: required("OPENROUTER_IMAGE_MODEL"), capcutTtsBaseUrl: env.CAPCUT_TTS_BASE_URL ?? "http://127.0.0.1:8765", capcutTtsVoiceIndex: Number(env.CAPCUT_TTS_VOICE_INDEX ?? "25"), capcutTtsRate: env.CAPCUT_TTS_RATE ?? "1.0", maxGeneratedImages };
};
~~~

`assertCredentialedPreflight` must call `${localLlmBaseUrl}/models` and `${capcutTtsBaseUrl}/api/voices`, throw `Local LLM is unavailable at <url>` or `CapCut TTS is unavailable at <url>` on failure, and never contact OpenRouter.

- [ ] **Step 4: Add runtime configuration documentation.**

Append this to `.env.example`:

~~~dotenv
LOCAL_LLM_BASE_URL=http://localhost:20128/v1
LOCAL_LLM_MODEL=cx/gpt-5.6-terra
OPENROUTER_API_KEY=
OPENROUTER_IMAGE_MODEL=
OPENROUTER_IMAGE_BASE_URL=https://openrouter.ai/api/v1
CAPCUT_TTS_BASE_URL=http://127.0.0.1:8765
CAPCUT_TTS_VOICE_INDEX=25
CAPCUT_TTS_RATE=1.0
MAX_GENERATED_IMAGES_PER_PROJECT=10
~~~

- [ ] **Step 5: Verify and commit.**

Run: `pnpm --filter @ksvf/test-kit test -- credentialed-config.test.ts`

Expected: PASS.

~~~bash
git add packages/test-kit/src/credentialed/config.ts packages/test-kit/test/credentialed-config.test.ts .env.example
git commit -m "feat: add credentialed run configuration"
~~~

### Task 2: Implement local LLM, OpenRouter image, and CapCut TTS adapters

**Files:**
- Create: `packages/editorial/src/local-llm-provider.ts`
- Create: `packages/assets/src/openrouter-provider.ts`
- Create: `packages/audio/src/capcut-provider.ts`
- Modify: `packages/editorial/src/index.ts`, `packages/assets/src/index.ts`, `packages/audio/src/index.ts`
- Test: `packages/editorial/test/local-llm-provider.test.ts`, `packages/assets/test/openrouter-provider.test.ts`, `packages/audio/test/capcut-provider.test.ts`

**Interfaces:**
- Produces `LocalOpenAiCompatibleProvider implements LanguageModelProvider`.
- Produces `OpenRouterImageProvider implements ImageGenerationProvider`.
- Produces `CapCutTtsProvider implements TtsProvider`.
- Each adapter takes an injected `fetch` function; unit tests make no network calls.

- [ ] **Step 1: Write the failing adapter tests.**

~~~ts
it("parses a local chat-completion JSON response with the configured model", async () => {
  const provider = new LocalOpenAiCompatibleProvider("http://localhost:20128/v1", "cx/gpt-5.6-terra", async (_url, init) => {
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "cx/gpt-5.6-terra", response_format: { type: "json_object" } });
    return new Response(JSON.stringify({ choices: [{ message: { content: "{"language":"ja-JP","scenes":[]}" } }] }));
  });
  await expect(provider.generateStructured({ model: "", schema: LocalizedScriptSchema, promptTemplateRef: { id: "localized-script", version: 1 }, language: "ja-JP", system: "s", user: "u" })).resolves.toMatchObject({ language: "ja-JP" });
});

it("decodes OpenRouter b64_json into a PNG asset", async () => {
  const provider = new OpenRouterImageProvider({ apiKey: "secret", model: "image-model" }, async (_url, init) => {
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "image-model", n: 1, output_format: "png" });
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("png").toString("base64") }] }));
  });
  await expect(provider.generate({ prompt: "rome", negativePrompt: "text", alphaRequired: true, aspectRatio: "9:16" })).resolves.toMatchObject({ bytes: Buffer.from("png"), mimeType: "image/png" });
});

it("sends CapCut's raw-TTS body and preserves MP3 bytes", async () => {
  const provider = new CapCutTtsProvider({ baseUrl: "http://127.0.0.1:8765", voiceIndex: 25, rate: "1.0", durationMs: 10_000 }, async (_url, init) => {
    expect(JSON.parse(String(init?.body))).toEqual({ text: "ローマ", voice_index: 25, rate: "1.0" });
    return new Response(Buffer.from("mp3"), { headers: { "content-type": "audio/mpeg" } });
  });
  await expect(provider.synthesize({ text: "ローマ", language: "ja-JP", voiceId: "ignored" })).resolves.toMatchObject({ bytes: Buffer.from("mp3"), mimeType: "audio/mpeg", durationMs: 10_000 });
});
~~~

- [ ] **Step 2: Run the adapter tests to verify they fail.**

Run: `pnpm --filter @ksvf/editorial test -- local-llm-provider.test.ts && pnpm --filter @ksvf/assets test -- openrouter-provider.test.ts && pnpm --filter @ksvf/audio test -- capcut-provider.test.ts`

Expected: FAIL because the three adapter classes do not exist.

- [ ] **Step 3: Implement the minimal adapters.**

`LocalOpenAiCompatibleProvider.generateStructured` posts to `${baseUrl}/chat/completions` with system/user messages and `response_format: {type:"json_object"}`, uses `input.model || defaultModel`, requires `choices[0].message.content`, parses JSON, and calls `input.schema.parse`.

`OpenRouterImageProvider.generate` posts with `Authorization: Bearer <key>` and body `{model,prompt,n:1,aspect_ratio,output_format:"png",background,quality:"low"}`; it requires `data[0].b64_json` and returns `{bytes: Buffer.from(b64_json,"base64"), mimeType:"image/png", providerAssetId:"openrouter-image-0"}`. Failure messages contain only HTTP status codes.

`CapCutTtsProvider.synthesize` posts `{text,voice_index,rate}` to `/api/tts/raw`, requires a successful nonempty response, and returns the configured fixed `durationMs: 10_000`. The first vertical slice uses fixed scene duration instead of MP3-duration probing.

- [ ] **Step 4: Export adapters and verify.**

Run: `pnpm --filter @ksvf/editorial test -- local-llm-provider.test.ts && pnpm --filter @ksvf/assets test -- openrouter-provider.test.ts && pnpm --filter @ksvf/audio test -- capcut-provider.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~bash
git add packages/editorial packages/assets packages/audio
git commit -m "feat: add local llm openrouter and capcut adapters"
~~~

### Task 3: Enforce image budget and produce a real Rome run manifest

**Files:**
- Create: `packages/test-kit/src/credentialed/image-budget.ts`
- Create: `packages/test-kit/src/credentialed/rome-run.ts`
- Modify: `packages/test-kit/src/pilots/index.ts`
- Test: `packages/test-kit/test/image-budget.test.ts`, `packages/test-kit/test/credentialed-rome-run.test.ts`

**Interfaces:**
- Produces `ImageBudget.reserve(cacheKey): "cache-hit" | "reserved"` and `ImageBudget.commit(cacheKey, assetId): void`.
- Produces `runCredentialedRome(input): Promise<CredentialedRomeResult>`.
- `CredentialedRomeResult` has six scenes, no more than six image files, six MP3 files, traceable artifact records, and a render request consumed by Task 4.

- [ ] **Step 1: Write the failing budget and runner tests.**

~~~ts
it("allows a cache hit after reaching the ten-image limit", () => {
  const budget = new ImageBudget(10);
  for (let index = 0; index < 10; index += 1) { expect(budget.reserve(`key-${index}`)).toBe("reserved"); budget.commit(`key-${index}`, `asset-${index}`); }
  expect(budget.reserve("key-0")).toBe("cache-hit");
  expect(() => budget.reserve("key-10")).toThrow("image budget exhausted: maximum 10 generated images per project");
});

it("builds six scenes and never requests more than six images", async () => {
  const result = await runCredentialedRome({ config, llm, imageProvider, ttsProvider, outputDirectory: temporaryDirectory });
  expect(result.scenes).toHaveLength(6);
  expect(result.imageArtifactIds).toHaveLength(6);
  expect(imageProvider.calls).toHaveLength(6);
  expect(result.renderRequest.durationInFrames).toBe(1800);
});
~~~

- [ ] **Step 2: Run focused tests to verify failure.**

Run: `pnpm --filter @ksvf/test-kit test -- image-budget.test.ts credentialed-rome-run.test.ts`

Expected: FAIL because `ImageBudget` and `runCredentialedRome` do not exist.

- [ ] **Step 3: Implement bounded artifact generation.**

Define deterministic scene IDs `scene-01` through `scene-06`; every scene has one generated primary layer, a CSS-only paper background, a 10-second narration segment, and a Japanese subtitle. Ask the local LLM once for a JSON response matching:

~~~ts
const RomeNarrationSchema = z.object({
  scenes: z.array(z.object({ id: z.string(), narration: z.string().min(1), imagePrompt: z.string().min(1) })).length(6)
});
~~~

For each scene, compute an `AssetGenerationFingerprint`, reserve its key, call the image provider only for `"reserved"`, write PNG at `<outputDirectory>/assets/<scene-id>.png`, call CapCut TTS, and write MP3 at `<outputDirectory>/audio/<scene-id>.mp3`. Create immutable artifacts for `FactPackage`, `LocalizedScript`, `DirectorStoryboard`, six `ApprovedAsset`, six `NarrationClip`, `Render`, `QAReport`, and `PublishingPackage`; every derived artifact lists direct input IDs. Seed the fact package with three public Rome source URLs and retain source IDs in the final lineage.

- [ ] **Step 4: Verify.**

Run: `pnpm --filter @ksvf/test-kit test -- image-budget.test.ts credentialed-rome-run.test.ts`

Expected: PASS; fake providers receive six image and six narration calls.

- [ ] **Step 5: Commit.**

~~~bash
git add packages/test-kit/src packages/test-kit/test
git commit -m "feat: add bounded credentialed Rome runner"
~~~

### Task 4: Render six real scenes with generated media and narration

**Files:**
- Create: `apps/remotion/src/run-props.ts`
- Modify: `apps/remotion/src/types.ts`, `apps/remotion/src/Root.tsx`, `apps/remotion/src/VideoComposition.tsx`, `apps/remotion/src/scenes/LayeredScene.tsx`
- Modify: `packages/test-kit/src/credentialed/rome-run.ts`
- Test: `apps/remotion/test/run-props.test.ts`

**Interfaces:**
- Produces `buildRomeVideoProps(result): RomeVideoProps`.
- Produces a `KnowledgeStoryRun` Remotion composition with 1,800 frames, 1080x1920, and 30 fps.
- Each run scene contains `imagePath`, `audioPath`, `subtitle`, and a 300-frame duration.

- [ ] **Step 1: Write a failing run-props test.**

~~~ts
import { expect, it } from "vitest";
import { buildRomeVideoProps } from "../src/run-props.js";

it("lays out six ten-second media scenes sequentially", () => {
  const props = buildRomeVideoProps(fixtureRun);
  expect(props.scenes).toHaveLength(6);
  expect(props.scenes[1]).toMatchObject({ from: 300, durationInFrames: 300, imagePath: "runs/rome-ja/assets/scene-02.png", audioPath: "runs/rome-ja/audio/scene-02.mp3" });
});
~~~

- [ ] **Step 2: Verify failure.**

Run: `pnpm --filter @ksvf/remotion test -- run-props.test.ts`

Expected: FAIL because `buildRomeVideoProps` does not exist.

- [ ] **Step 3: Implement dynamic Remotion media rendering.**

`buildRomeVideoProps` maps each runner scene to `{from:index*300,durationInFrames:300,imagePath,audioPath,subtitle,scene}`. Add a `KnowledgeStoryRun` composition. In `VideoComposition`, use one `Sequence` per scene; render `<Img src={staticFile(imagePath)}>` behind `LayeredScene`, `<Audio src={staticFile(audioPath)}>`, and the subtitle inside the bottom 18% safe area. Preserve `KnowledgeStoryFixture` unchanged.

Before rendering, copy the runner's media to `apps/remotion/public/runs/rome-ja/`, write props to `out/rome-ja.remotion-props.json`, then run:

~~~bash
pnpm --filter @ksvf/remotion exec remotion render src/index.ts KnowledgeStoryRun out/rome-ja.mp4 --props out/rome-ja.remotion-props.json
~~~

- [ ] **Step 4: Verify the unit test and fixture render.**

Run: `pnpm --filter @ksvf/remotion test -- run-props.test.ts && pnpm --filter @ksvf/remotion render:fixture`

Expected: PASS and `out/fixture.mp4` exists.

- [ ] **Step 5: Commit.**

~~~bash
git add apps/remotion packages/test-kit/src/credentialed/rome-run.ts
git commit -m "feat: render credentialed Rome media sequence"
~~~

### Task 5: Expose the credentialed CLI, verify outputs, and document startup

**Files:**
- Modify: `scripts/run-pilot.ts`, `README.md`, `docs/runbook.md`, `docs/provider-setup.md`
- Create: `scripts/run-pilot.test.ts`

**Interfaces:**
- `pnpm tsx scripts/run-pilot.ts --pilot rome-ja --credentialed` executes preflight, provider calls, rendering, and `verifyRender`.
- The written publishing package reports `generatedImageCount <= 10` and contains final media metadata.

- [ ] **Step 1: Write a failing CLI parsing test.**

~~~ts
import { expect, it } from "vitest";
import { parsePilotArguments } from "./run-pilot.js";

it("requires rome-ja for the credentialed vertical slice", () => {
  expect(parsePilotArguments(["--pilot", "rome-ja", "--credentialed"])).toEqual({ pilot: "rome-ja", credentialed: true });
  expect(() => parsePilotArguments(["--pilot", "pompeii-ja", "--credentialed"])).toThrow("--credentialed currently supports rome-ja only");
});
~~~

- [ ] **Step 2: Verify failure.**

Run: `pnpm vitest run scripts/run-pilot.test.ts`

Expected: FAIL because `parsePilotArguments` is not exported.

- [ ] **Step 3: Implement command behavior and startup documentation.**

Keep current fixture behavior when `--credentialed` is absent. For `--credentialed`, load config, preflight local providers, construct the three adapters, invoke `runCredentialedRome`, render `out/rome-ja.mp4`, call `verifyRender("out/rome-ja.mp4")`, then write `out/rome-ja.publishing-package.json` with artifacts, lineage, image count, and verified media metadata.

Document these commands without printing secret values:

~~~bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
# use Node 22, install dependencies, and add OPENROUTER_API_KEY + OPENROUTER_IMAGE_MODEL to .env
cd /home/cuongdev/Documents/voice_video && python3 web_tts.py
pnpm tsx scripts/run-pilot.ts --pilot rome-ja --credentialed
pnpm tsx scripts/verify-render.ts out/rome-ja.mp4
~~~

State that CapCut must listen at the configured URL and that a clean run produces six OpenRouter cache misses.

- [ ] **Step 4: Run regression checks.**

Run: `pnpm test && pnpm lint && pnpm typecheck`

Expected: PASS on Node 22 with pnpm 9.

- [ ] **Step 5: Run live acceptance after credentials and CapCut are ready.**

Run: `pnpm tsx scripts/run-pilot.ts --pilot rome-ja --credentialed && pnpm tsx scripts/verify-render.ts out/rome-ja.mp4`

Expected: `out/rome-ja.mp4` exists; its package reports `generatedImageCount: 6`, contains complete source lineage, and the verifier reports a 1080x1920 30 fps video stream plus audio stream.

- [ ] **Step 6: Commit.**

~~~bash
git add scripts README.md docs .env.example
git commit -m "feat: add credentialed Rome acceptance command"
~~~

## Plan Self-Review

- **Spec coverage:** Task 1 implements configuration and reachability; Task 2 implements all three provider boundaries; Task 3 implements six-scene artifacts, source lineage, cache behavior, and the ten-image cap; Task 4 renders actual images and CapCut narration; Task 5 supplies the CLI, technical verifier, documentation, and live acceptance command.
- **No placeholders:** Every task has exact paths, interfaces, tests, commands, expected result, and commit scope.
- **Type consistency:** Task 1 produces `CredentialedConfig`; Task 2 produces the provider interfaces Task 3 consumes; Task 3 returns run-scene data Task 4 maps to Remotion props; Task 5 owns construction, render invocation, and final verification.

