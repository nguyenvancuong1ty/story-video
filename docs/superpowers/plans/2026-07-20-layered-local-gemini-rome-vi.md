# Layered Local-Gemini Rome VI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a Vietnamese, 60-second Rome pilot from independently generated local-Gemini cutout layers, CapCut narration, and Remotion—not image-to-video or placeholder shapes.

**Architecture:** Keep existing offline pilots untouched. Replace only the credentialed Rome path with five narrated beats, each composed of a six-second wide shot and six-second detail shot. Every shot has an explicit layer manifest; background, characters, and foreground are separate files, and green-backed character files are converted to transparent PNGs before Remotion consumes them.

**Tech Stack:** Node.js 22, TypeScript, Vitest, Zod, native fetch, Sharp, local OpenAI-compatible endpoint, CapCut TTS, Remotion, FFmpeg/ffprobe.

---

## File map

- `packages/assets/src/local-chat-image-provider.ts`: calls local chat-completions and decodes Markdown data-URL images.
- `packages/assets/src/processing.ts`: converts green-screen source bytes into alpha PNGs and rejects invalid cutouts.
- `packages/test-kit/src/credentialed/config.ts`: local image model configuration; no OpenRouter or image budget.
- `packages/test-kit/src/credentialed/rome-run.ts`: creates five Vietnamese beats, ten shots, generated assets, audio, and manifests.
- `apps/remotion/src/types.ts`, `apps/remotion/src/scenes/LayeredScene.tsx`, `apps/remotion/src/motion.ts`, `apps/remotion/src/VideoComposition.tsx`, `apps/remotion/src/run-props.ts`: renders real image layers with camera, staggered motion, narration, and captions.
- `scripts/run-pilot.ts`: exposes `rome-vi --credentialed`, copies nested media, renders and verifies the MP4.

### Task 1: Replace credentialed image configuration with the local Gemini contract

**Files:**
- Modify: `.env.example`
- Modify: `packages/test-kit/src/credentialed/config.ts`
- Modify: `packages/test-kit/test/credentialed-config.test.ts`
- Modify: `scripts/run-pilot.test.ts`

- [ ] **Step 1: Write the failing configuration tests.**

```ts
it("uses the local image defaults and Vietnamese CapCut voice", () => {
  expect(loadCredentialedConfig({ LOCAL_IMAGE_MODEL: "ag/gemini-3.1-flash-image" })).toMatchObject({
    localImageBaseUrl: "http://localhost:20128/v1",
    localImageModel: "ag/gemini-3.1-flash-image",
    capcutTtsVoiceIndex: 0
  });
});

it("requires a local image model without exposing any secret", () => {
  expect(() => loadCredentialedConfig({})).toThrow("LOCAL_IMAGE_MODEL is required for --credentialed");
});

it("accepts only the Vietnamese credentialed pilot", () => {
  expect(parsePilotArguments(["--pilot", "rome-vi", "--credentialed"])).toEqual({ pilot: "rome-vi", credentialed: true });
});
```

- [ ] **Step 2: Run the focused tests and verify they fail.**

Run: `pnpm --filter @ksvf/test-kit test -- credentialed-config.test.ts && pnpm test -- scripts/run-pilot.test.ts`

Expected: FAIL because `localImageBaseUrl`, `LOCAL_IMAGE_MODEL`, and `rome-vi` do not exist.

- [ ] **Step 3: Implement the local-only configuration.**

```ts
export type CredentialedConfig = {
  localLlmBaseUrl: string; localLlmModel: string;
  localImageBaseUrl: string; localImageModel: string;
  capcutTtsBaseUrl: string; capcutTtsVoiceIndex: number; capcutTtsRate: string;
};

const required = (environment: Environment, name: "LOCAL_IMAGE_MODEL"): string => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for --credentialed`);
  return value;
};
```

Use `http://localhost:20128/v1` for both local URL defaults, `cx/gpt-5.6-terra` for the writing model, `ag/gemini-3.1-flash-image` only when supplied in `.env`, and CapCut voice index `0`. Remove all `OPENROUTER_*` and `MAX_GENERATED_IMAGES_PER_PROJECT` parsing. Change the CLI union to `keyof typeof pilots | "rome-vi"`, and reject `--credentialed` for every value except `rome-vi`.

Set `.env.example` to:

```dotenv
LOCAL_LLM_BASE_URL=http://localhost:20128/v1
LOCAL_LLM_MODEL=cx/gpt-5.6-terra
LOCAL_IMAGE_BASE_URL=http://localhost:20128/v1
LOCAL_IMAGE_MODEL=ag/gemini-3.1-flash-image
CAPCUT_TTS_BASE_URL=http://127.0.0.1:8765
CAPCUT_TTS_VOICE_INDEX=0
CAPCUT_TTS_RATE=1.0
```

- [ ] **Step 4: Verify and commit.**

Run: `pnpm --filter @ksvf/test-kit test -- credentialed-config.test.ts && pnpm test -- scripts/run-pilot.test.ts`

Expected: PASS.

```bash
git add .env.example packages/test-kit/src/credentialed/config.ts packages/test-kit/test/credentialed-config.test.ts scripts/run-pilot.test.ts
git commit -m "feat: configure local Gemini image pilot"
```

### Task 2: Implement and test the local chat image provider

**Files:**
- Create: `packages/assets/src/local-chat-image-provider.ts`
- Create: `packages/assets/test/local-chat-image-provider.test.ts`
- Modify: `packages/assets/src/index.ts`
- Delete: `packages/assets/src/openrouter-provider.ts`
- Delete: `packages/assets/test/openrouter-provider.test.ts`

- [ ] **Step 1: Write failing provider tests for the verified local response shape.**

```ts
it("sends image modalities and decodes the Markdown data URL", async () => {
  const provider = new LocalChatImageProvider({ baseUrl: "http://localhost:20128/v1", model: "ag/gemini-3.1-flash-image" }, async (_url, init) => {
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "ag/gemini-3.1-flash-image", modalities: ["image", "text"],
      messages: [{ role: "user", content: [{ type: "text", text: "Rome" }] }]
    });
    return new Response(JSON.stringify({ choices: [{ message: { content: "![image](data:image/jpeg;base64,aW1hZ2U=)" } }] }));
  });
  await expect(provider.generate({ prompt: "Rome", negativePrompt: "", alphaRequired: false, aspectRatio: "9:16" }))
    .resolves.toMatchObject({ bytes: Buffer.from("image"), mimeType: "image/jpeg", providerAssetId: "local-chat-image-0" });
});

it("reports an HTTP status without returning provider body content", async () => {
  const provider = new LocalChatImageProvider({ baseUrl: "http://localhost:20128/v1", model: "ag/gemini-3.1-flash-image" }, async () => new Response("secret", { status: 429 }));
  await expect(provider.generate({ prompt: "Rome", negativePrompt: "", alphaRequired: false, aspectRatio: "9:16" })).rejects.toThrow("Local image generation failed: 429");
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `pnpm --filter @ksvf/assets test -- local-chat-image-provider.test.ts`

Expected: FAIL because `LocalChatImageProvider` does not exist.

- [ ] **Step 3: Add the minimal provider and exports.**

```ts
const markdownDataUrl = /!\[[^\]]*\]\((data:([^;,]+);base64,([^\s)]+))\)/s;

export class LocalChatImageProvider implements ImageGenerationProvider {
  constructor(private readonly options: { baseUrl: string; model: string }, private readonly fetcher: typeof fetch = fetch) {}
  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const response = await this.fetcher(`${this.options.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.options.model, modalities: ["image", "text"], messages: [{ role: "user", content: [{ type: "text", text: input.negativePrompt ? `${input.prompt}\nAvoid: ${input.negativePrompt}` : input.prompt }] }] })
    });
    if (!response.ok) throw new Error(`Local image generation failed: ${response.status}`);
    const content = (await response.json() as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
    const match = typeof content === "string" ? content.match(markdownDataUrl) : null;
    if (!match) throw new Error("Local image generation returned no Markdown data image");
    return { bytes: Buffer.from(match[3], "base64"), mimeType: match[2], providerAssetId: "local-chat-image-0" };
  }
}
```

Export it from `packages/assets/src/index.ts`; remove OpenRouter exports and files so no API key or curl transport remains.

- [ ] **Step 4: Verify and commit.**

Run: `pnpm --filter @ksvf/assets test -- local-chat-image-provider.test.ts && pnpm --filter @ksvf/assets test`

Expected: PASS.

```bash
git add packages/assets
git commit -m "feat: generate assets through local Gemini chat"
```

### Task 3: Convert green-backed character assets into transparent PNGs

**Files:**
- Modify: `packages/assets/src/processing.ts`
- Create: `packages/assets/test/processing.test.ts`

- [ ] **Step 1: Write the failing alpha tests.**

```ts
it("removes chroma green while keeping an opaque red subject", async () => {
  const source = await sharp({ create: { width: 2, height: 1, channels: 3, background: "#00ff00" } }).composite([{ input: { create: { width: 1, height: 1, channels: 4, background: "#ff0000" } }, left: 1, top: 0 }]).png().toBuffer();
  const output = await removeGreenScreen(source);
  const { data } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(data[3]).toBe(0); expect(data[7]).toBe(255);
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `pnpm --filter @ksvf/assets test -- processing.test.ts`

Expected: FAIL because `removeGreenScreen` does not exist.

- [ ] **Step 3: Implement deterministic chroma removal.**

```ts
export const removeGreenScreen = async (bytes: Buffer): Promise<Buffer> => {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const [red, green, blue] = [data[index], data[index + 1], data[index + 2]];
    if (green > 135 && green > red * 1.25 && green > blue * 1.25) data[index + 3] = 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
};
```

Keep `normalizeAssetCanvas` for environment plates; apply `removeGreenScreen` only to primary, secondary, tertiary, and foreground generation results.

- [ ] **Step 4: Verify and commit.**

Run: `pnpm --filter @ksvf/assets test -- processing.test.ts`

Expected: PASS.

```bash
git add packages/assets/src/processing.ts packages/assets/test/processing.test.ts
git commit -m "feat: convert green screen cutouts to alpha png"
```

### Task 4: Produce five Vietnamese beats with ten real layer manifests

**Files:**
- Modify: `packages/test-kit/src/credentialed/rome-run.ts`
- Modify: `packages/test-kit/test/credentialed-rome-run.test.ts`
- Delete: `packages/test-kit/src/credentialed/image-budget.ts`
- Delete: `packages/test-kit/test/image-budget.test.ts`

- [ ] **Step 1: Replace the old single-image runner assertion with manifest assertions.**

```ts
it("creates five Vietnamese beats, each with a wide and detail shot", async () => {
  const result = await runCredentialedRome({ config, languageModel, imageProvider, ttsProvider, outputDirectory: temporaryDirectory });
  expect(result.beats).toHaveLength(5);
  expect(result.beats.every((beat) => beat.shots.map((shot) => shot.id).join(",") === `${beat.id}-wide,${beat.id}-detail`)).toBe(true);
  expect(result.beats.flatMap((beat) => beat.shots).every((shot) => shot.layers.some((layer) => layer.role === "background") && shot.layers.some((layer) => layer.role === "primary") && shot.layers.some((layer) => layer.role === "foreground"))).toBe(true);
  expect(result.renderRequest.durationInFrames).toBe(1800);
});
```

- [ ] **Step 2: Run the runner test and verify it fails.**

Run: `pnpm --filter @ksvf/test-kit test -- credentialed-rome-run.test.ts`

Expected: FAIL because `CredentialedRomeResult` has `scenes`, not `beats`.

- [ ] **Step 3: Define the beat, shot, and layer contract in `rome-run.ts`.**

```ts
export type CredentialedLayer = {
  id: string; role: "background" | "tertiary" | "secondary" | "primary" | "foreground";
  assetPath: string; x: number; y: number; widthPercent: number; zIndex: number;
  delayFrames: number; entrance: "none" | "rise" | "left" | "right";
};
export type CredentialedShot = { id: string; durationInFrames: 180; camera: { startScale: number; endScale: number; startX: number; endX: number; startY: number; endY: number }; layers: CredentialedLayer[] };
export type CredentialedBeat = { id: string; narration: string; subtitle: string; audioPath: string; narrationArtifactId: string; shots: [CredentialedShot, CredentialedShot] };
```

Ask Terra once for exactly `beat-01` through `beat-05`, each a factual Vietnamese narration of 25--35 words about Rome and a concise subtitle. For every `<beat>-wide` and `<beat>-detail`, make five calls to `LocalChatImageProvider`: a no-person environment plate, green-screen primary, green-screen secondary, green-screen tertiary, and green-screen foreground. Use these fixed prompt suffixes:

```ts
const promptRules = {
  background: "vertical 9:16 paper collage environment only, no people, no text, no watermark",
  primary: "one full-body main character on pure chroma green, white cut-paper outline, no text, no shadow",
  secondary: "one supporting full-body character on pure chroma green, white cut-paper outline, no text, no shadow",
  tertiary: "small distant full-body supporting character on pure chroma green, white cut-paper outline, no text, no shadow",
  foreground: "paper scraps and a foreground prop on pure chroma green, no text, no watermark"
} as const;
```

Write plates through `normalizeAssetCanvas`; write all other assets through `removeGreenScreen`. Persist each shot below `out/rome-vi/assets/<shot-id>/` as `background.png`, `primary.png`, `secondary.png`, `tertiary.png`, and `foreground.png`. Generate one MP3 per beat at `out/rome-vi/audio/<beat-id>.mp3`. Use layout values `background: (0,0,100,z0,0,none)`, `tertiary: (72,42,24,z2,30,right)`, `secondary: (21,52,36,z3,18,left)`, `primary: (50,54,54,z5,4,rise)`, `foreground: (50,79,108,z7,46,rise)`.

Delete `ImageBudget` imports, fields, tests, and generated-image cap. Keep artifact lineage, but create `ApprovedAsset` artifacts per layer and use provider metadata `{ provider: "local-chat", model: config.localImageModel }`.

- [ ] **Step 4: Verify the runner and full test-kit package.**

Run: `pnpm --filter @ksvf/test-kit test -- credentialed-rome-run.test.ts && pnpm --filter @ksvf/test-kit test`

Expected: PASS with no references to `openrouter`, `ImageBudget`, or `rome-ja` in credentialed code.

- [ ] **Step 5: Commit.**

```bash
git add packages/test-kit/src/credentialed/rome-run.ts packages/test-kit/test/credentialed-rome-run.test.ts packages/test-kit/src/credentialed/image-budget.ts packages/test-kit/test/image-budget.test.ts
git commit -m "feat: build Vietnamese layered Rome manifests"
```

### Task 5: Render manifests as paper-cutout animation in Remotion

**Files:**
- Modify: `apps/remotion/src/types.ts`
- Modify: `apps/remotion/src/motion.ts`
- Modify: `apps/remotion/src/scenes/LayeredScene.tsx`
- Modify: `apps/remotion/src/VideoComposition.tsx`
- Modify: `apps/remotion/src/run-props.ts`
- Modify: `apps/remotion/src/Root.tsx`
- Test: `apps/remotion/src/motion.test.ts`, `apps/remotion/src/run-props.test.ts`

- [ ] **Step 1: Write failing motion and prop tests.**

```ts
it("gives a primary layer a larger delayed rise than a tertiary layer", () => {
  expect(getLayerTransform({ role: "primary", entrance: "rise", delayFrames: 4, x: 50, y: 54, widthPercent: 54, zIndex: 5, id: "p", assetPath: "p.png" }, 4)).toContain("scale(0.86)");
  expect(getLayerTransform({ role: "tertiary", entrance: "right", delayFrames: 30, x: 72, y: 42, widthPercent: 24, zIndex: 2, id: "t", assetPath: "t.png" }, 30)).toContain("translateX(38px)");
});

it("maps a beat to one audio sequence and two visual sequences", () => {
  expect(buildRomeVideoProps({ beats: [beat] }).beats[0]).toMatchObject({ from: 0, durationInFrames: 360, shots: [{ from: 0 }, { from: 180 }] });
});
```

- [ ] **Step 2: Run the tests and verify they fail.**

Run: `pnpm --filter @ksvf/remotion test -- motion.test.ts run-props.test.ts`

Expected: FAIL because run props still expect one `imagePath` per scene.

- [ ] **Step 3: Implement layer-aware types, motion, and composition.**

Use these run types:

```ts
export type RenderLayer = CredentialedLayer;
export type RunVideoProps = { beats: Array<{ id: string; from: number; durationInFrames: number; audioPath: string; subtitle: string; shots: Array<{ id: string; from: number; durationInFrames: number; camera: CredentialedShot["camera"]; layers: RenderLayer[] }> }> };
```

`buildRomeVideoProps` must assign each beat `from: beatIndex * 360`, `durationInFrames: 360`, and its shots `from: shotIndex * 180`. `LayeredScene` must render `<Img src={staticFile(layer.assetPath)}>` for every layer; it must not render colored rectangles, SVG dots, `assetType`, or CSS mock backgrounds. Render in ascending `zIndex`, apply the camera transform only to the background image, and apply a 5px white drop-shadow outline plus a dark 18px shadow to non-background cutouts.

Implement `getLayerTransform` with role distances `{ primary: 78, secondary: 58, tertiary: 38, foreground: 28, background: 0 }`, start scales `{ primary: .86, secondary: .90, tertiary: .95, foreground: .98, background: 1 }`, and a 30-frame eased entry. It must use `entrance` to move from below, left, right, or no offset, then retain a `Math.sin(frame / 18) * 3` vertical float after entry.

`VideoComposition` must have one outer `<Sequence>` per beat containing exactly one `<Audio>` and one bottom subtitle. Inside it, create one nested `<Sequence>` per shot and render `LayeredScene`. Keep the caption in a semitransparent bottom gradient at `bottom: "7%"`; it must not be duplicated for the two shots.

- [ ] **Step 4: Verify and commit.**

Run: `pnpm --filter @ksvf/remotion test && pnpm --filter @ksvf/remotion exec remotion compositions src/index.ts`

Expected: PASS and list `KnowledgeStoryRun` at 1080x1920, 30 fps, 1800 frames.

```bash
git add apps/remotion/src
git commit -m "feat: render layered paper cutout beats"
```

### Task 6: Wire `rome-vi` through render, QA, documentation, and a live acceptance run

**Files:**
- Modify: `scripts/run-pilot.ts`
- Modify: `scripts/run-pilot.test.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-20-local-gemini-image-provider-design.md`

- [ ] **Step 1: Write failing CLI media-copy tests.**

```ts
it("copies every nested layer and each beat MP3 to the public Rome VI run", async () => {
  await copyRunMedia(result);
  await expect(stat("apps/remotion/public/runs/rome-vi/assets/beat-01-wide/primary.png")).resolves.toMatchObject({ isFile: expect.any(Function) });
  await expect(stat("apps/remotion/public/runs/rome-vi/audio/beat-01.mp3")).resolves.toMatchObject({ isFile: expect.any(Function) });
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `pnpm test -- scripts/run-pilot.test.ts`

Expected: FAIL because `copyRunMedia` only accepts monolithic scene image paths and targets `rome-ja`.

- [ ] **Step 3: Implement the credentialed `rome-vi` command.**

```ts
const publicDirectory = resolve("apps/remotion/public/runs/rome-vi");
const media = result.beats.flatMap((beat) => [
  { source: beat.audioPath, target: resolve(publicDirectory, "audio", `${beat.id}.mp3`) },
  ...beat.shots.flatMap((shot) => shot.layers.map((layer) => ({ source: layer.assetPath, target: resolve(publicDirectory, "assets", shot.id, layer.assetPath.split("/").at(-1) as string })))
]);
await Promise.all(media.map(async ({ source, target }) => { await mkdir(resolve(target, ".."), { recursive: true }); await copyFile(source, target); }));
```

Instantiate `LocalChatImageProvider({ baseUrl: config.localImageBaseUrl, model: config.localImageModel })`, pass it to `runCredentialedRome`, write `out/rome-vi.remotion-props.json` from `buildRomeVideoProps({ beats: result.beats })`, render to `out/rome-vi.mp4`, call `verifyRender`, and write `out/rome-vi.publishing-package.json`. Do not read or log `.env` values other than loading it. Update the README command and configuration table to use only `LOCAL_IMAGE_*`, CapCut Vietnamese voice index `0`, and:

```bash
pnpm run pilot -- --pilot rome-vi --credentialed
```

Add the final acceptance requirements to the design doc: five beats, ten shots, independent layer files, no generated mock blocks, image-to-video disabled, and no generation cap.

- [ ] **Step 4: Verify unit tests, type checks, and static render contract.**

Run: `pnpm test -- scripts/run-pilot.test.ts && pnpm lint && pnpm typecheck && pnpm --filter @ksvf/remotion exec remotion compositions src/index.ts`

Expected: every command exits 0; composition reports 1080x1920, 30 fps, 1800 frames.

- [ ] **Step 5: Commit the wiring and documentation.**

```bash
git add scripts/run-pilot.ts scripts/run-pilot.test.ts README.md docs/superpowers/specs/2026-07-20-local-gemini-image-provider-design.md
git commit -m "feat: render Vietnamese layered Rome pilot"
```

- [ ] **Step 6: Run live acceptance after code tests pass.**

Run: `pnpm run pilot -- --pilot rome-vi --credentialed`

Expected: `out/rome-vi.mp4` and `out/rome-vi.publishing-package.json` exist; the package reports verified H.264 video with audio, 1080x1920 at 30 fps, and 60-second duration.

Run: `ffmpeg -y -ss 5 -i out/rome-vi.mp4 -frames:v 1 out/rome-vi-check-05.png && ffmpeg -y -ss 29 -i out/rome-vi.mp4 -frames:v 1 out/rome-vi-check-29.png && ffmpeg -y -ss 53 -i out/rome-vi.mp4 -frames:v 1 out/rome-vi-check-53.png`

Expected: each frame contains image assets with paper-cutout depth, no red square/dot placeholders, and Vietnamese caption placement below the primary character.

## Self-review

1. **Spec coverage:** Task 1 removes OpenRouter, image caps, and configures Terra plus local Gemini and Vietnamese CapCut. Tasks 2--3 implement the verified Markdown data-URL response and alpha conversion. Task 4 creates five Vietnamese beats with wide/detail manifests and deterministic layer order. Task 5 implements Remotion layout, staggered role motion, captions, and one audio track per beat. Task 6 runs the full pipeline, technical verification, and three frame inspections. No image-to-video step is introduced.
2. **Placeholder scan:** Reviewed every task for deferred-work markers and generic error-handling instructions; none remain.
3. **Type consistency:** `CredentialedLayer`, `CredentialedShot`, and `CredentialedBeat` originate in Task 4; Task 5 consumes those exact names to form `RunVideoProps`; Task 6 passes `result.beats` to `buildRomeVideoProps`. All timeline arithmetic is fixed at five beats × two shots × 180 frames = 1800 frames.
