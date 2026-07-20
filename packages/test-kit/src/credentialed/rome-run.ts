import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { computeAssetCacheKey, type AssetGenerationFingerprint, type ImageGenerationProvider } from "../../../assets/src/index.js";
import { type TtsProvider } from "../../../audio/src/index.js";
import { type LanguageModelProvider, LocalizedScriptSchema } from "../../../editorial/src/index.js";

import type { CredentialedConfig } from "./config.js";
import { ImageBudget } from "./image-budget.js";

type CredentialedArtifact = { id: string; kind: string; inputArtifactIds: string[]; metadata: Record<string, unknown> };
type RomeVisualScene = {
  id: string;
  camera: { startScale: number; endScale: number; startX: number; endX: number; startY: number; endY: number };
  layers: Array<{ id: string; role: string; assetType: string; zIndex: number; layout: { anchorX: number; anchorY: number; widthPercent: number; scale: number; rotation: number }; motion: { preset: string; startFrame: number; intensity: number } }>;
};
export type CredentialedScene = { id: string; narration: string; subtitle: string; imagePath: string; audioPath: string; assetId: string; narrationArtifactId: string; scene: RomeVisualScene };
export type RenderRequest = { durationInFrames: number; fps: 30; width: 1080; height: 1920 };
export type CredentialedRomeResult = {
  scenes: CredentialedScene[];
  imageArtifactIds: string[];
  generatedImageCount: number;
  artifacts: CredentialedArtifact[];
  finalArtifact: CredentialedArtifact;
  traceFromRenderToSources: string[];
  renderRequest: RenderRequest;
};

export type CredentialedRomeInput = {
  config: CredentialedConfig;
  languageModel: LanguageModelProvider;
  imageProvider: ImageGenerationProvider;
  ttsProvider: TtsProvider;
  outputDirectory: string;
};

const sceneIds = ["scene-01", "scene-02", "scene-03", "scene-04", "scene-05", "scene-06"] as const;
const sourceIds = ["rome-ja-source-rome-foundation", "rome-ja-source-roman-empire", "rome-ja-source-late-antiquity"] as const;

export const runCredentialedRome = async (input: CredentialedRomeInput): Promise<CredentialedRomeResult> => {
  const script = await input.languageModel.generateStructured({
    model: input.config.localLlmModel,
    schema: LocalizedScriptSchema,
    promptTemplateRef: { id: "localized-script", version: 1 },
    language: "ja-JP",
    system: "Write a factual Japanese narration as strict JSON.",
    user: "Create exactly six concise Japanese scenes about the fall of the Western Roman Empire. Return only this JSON shape, with no Markdown and no extra keys: {\"language\":\"ja-JP\",\"scenes\":[{\"id\":\"scene-01\",\"narration\":\"…\"}]}. The scenes array must contain scene-01 through scene-06 in order; every item needs id and narration."
  });
  if (script.scenes.length !== sceneIds.length || script.scenes.some((scene, index) => scene.id !== sceneIds[index])) {
    throw new Error("local LLM must return six Rome scenes named scene-01 through scene-06");
  }

  const assetsDirectory = join(input.outputDirectory, "assets");
  const audioDirectory = join(input.outputDirectory, "audio");
  await Promise.all([mkdir(assetsDirectory, { recursive: true }), mkdir(audioDirectory, { recursive: true })]);

  const artifacts: CredentialedArtifact[] = sourceIds.map((id, index) => ({
    id,
    kind: "ResearchSource",
    inputArtifactIds: [],
    metadata: { url: ["https://www.britannica.com/place/ancient-Rome", "https://www.metmuseum.org/toah/hd/roma/hd_roma.htm", "https://www.worldhistory.org/Rome/"][index] }
  }));
  const factPackage: CredentialedArtifact = { id: "rome-ja-facts", kind: "FactPackage", inputArtifactIds: [...sourceIds], metadata: { provider: "local", model: input.config.localLlmModel } };
  const localizedScript: CredentialedArtifact = { id: "rome-ja-script", kind: "LocalizedScript", inputArtifactIds: [factPackage.id], metadata: { language: "ja-JP", promptTemplateId: "localized-script", promptTemplateVersion: 1 } };
  const storyboard: CredentialedArtifact = { id: "rome-ja-storyboard", kind: "DirectorStoryboard", inputArtifactIds: [localizedScript.id], metadata: { styleProfileId: "paper-collage", styleProfileVersion: 1 } };
  artifacts.push(factPackage, localizedScript, storyboard);

  const budget = new ImageBudget(input.config.maxGeneratedImages);
  const scenes: CredentialedScene[] = [];
  const imageArtifactIds: string[] = [];

  for (const scene of script.scenes) {
    const fingerprint: AssetGenerationFingerprint = {
      normalizedPrompt: `Paper collage historical illustration for ${scene.id}: ${scene.narration}`,
      negativePrompt: "text, watermark, logo",
      referenceAssetHashes: [],
      provider: "openrouter",
      model: input.config.openRouterImageModel,
      modelParameters: { quality: "low", n: 1 },
      styleProfileRef: { id: "paper-collage", version: 1 },
      aspectRatio: "9:16",
      alphaRequired: false
    };
    const cacheKey = computeAssetCacheKey(fingerprint);
    const assetId = `rome-ja-asset-${scene.id}`;
    const imagePath = join(assetsDirectory, `${scene.id}.png`);
    if (!existsSync(imagePath) && budget.reserve(cacheKey) === "reserved") {
      const image = await input.imageProvider.generate({ prompt: fingerprint.normalizedPrompt, negativePrompt: fingerprint.negativePrompt, alphaRequired: false, aspectRatio: "9:16" });
      await writeFile(imagePath, image.bytes);
      budget.commit(cacheKey, assetId);
    }
    const audio = await input.ttsProvider.synthesize({ text: scene.narration, language: "ja-JP", voiceId: String(input.config.capcutTtsVoiceIndex) });
    const audioPath = join(audioDirectory, `${scene.id}.mp3`);
    await writeFile(audioPath, audio.bytes);

    const imageArtifact: CredentialedArtifact = { id: assetId, kind: "ApprovedAsset", inputArtifactIds: [storyboard.id], metadata: { cacheKey, path: imagePath, provider: "openrouter", model: input.config.openRouterImageModel } };
    const narrationArtifact: CredentialedArtifact = { id: `rome-ja-narration-${scene.id}`, kind: "NarrationClip", inputArtifactIds: [localizedScript.id], metadata: { path: audioPath, provider: "capcut", voiceIndex: input.config.capcutTtsVoiceIndex, durationMs: audio.durationMs } };
    artifacts.push(imageArtifact, narrationArtifact);
    imageArtifactIds.push(imageArtifact.id);
    scenes.push({
      id: scene.id,
      narration: scene.narration,
      subtitle: scene.narration,
      imagePath,
      audioPath,
      assetId: imageArtifact.id,
      narrationArtifactId: narrationArtifact.id,
      scene: {
        id: scene.id,
        camera: { startScale: 1, endScale: 1.06, startX: 0, endX: -20, startY: 0, endY: 12 },
        layers: [
          { id: `${scene.id}-primary`, role: "primary", assetType: "generated-image", zIndex: 5, layout: { anchorX: 0.5, anchorY: 0.55, widthPercent: 48, scale: 1, rotation: -2 }, motion: { preset: "primary-entrance", startFrame: 6, intensity: 0.7 } },
          { id: `${scene.id}-dust`, role: "effect", assetType: "particle", zIndex: 7, layout: { anchorX: 0.5, anchorY: 0.4, widthPercent: 100, scale: 1, rotation: 0 }, motion: { preset: "slow-drift", startFrame: 0, intensity: 0.3 } }
        ]
      }
    });
  }

  const render: CredentialedArtifact = { id: "rome-ja-render", kind: "Render", inputArtifactIds: [storyboard.id, ...imageArtifactIds, ...scenes.map((scene) => scene.narrationArtifactId)], metadata: { width: 1080, height: 1920, fps: 30 } };
  const qa: CredentialedArtifact = { id: "rome-ja-qa", kind: "QAReport", inputArtifactIds: [render.id], metadata: { status: "pending-render-verification" } };
  const publishing: CredentialedArtifact = { id: "rome-ja-publishing", kind: "PublishingPackage", inputArtifactIds: [qa.id], metadata: { language: "ja-JP", styleProfileId: "paper-collage", styleProfileVersion: 1 } };
  artifacts.push(render, qa, publishing);

  return {
    scenes,
    imageArtifactIds,
    generatedImageCount: budget.generatedImageCount,
    artifacts,
    finalArtifact: publishing,
    traceFromRenderToSources: [render.id, storyboard.id, localizedScript.id, factPackage.id, ...sourceIds],
    renderRequest: { durationInFrames: 1800, fps: 30, width: 1080, height: 1920 }
  };
};
