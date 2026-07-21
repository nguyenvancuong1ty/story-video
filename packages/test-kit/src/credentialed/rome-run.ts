import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { normalizeAssetCanvas, removeGreenScreen, type ImageGenerationProvider } from "../../../assets/src/index.js";
import { type TtsProvider } from "../../../audio/src/index.js";
import { type LanguageModelProvider, LocalizedScriptSchema } from "../../../editorial/src/index.js";

import type { CredentialedConfig } from "./config.js";

type CredentialedArtifact = { id: string; kind: string; inputArtifactIds: string[]; metadata: Record<string, unknown> };
export type CredentialedLayer = {
  id: string;
  role: "background" | "tertiary" | "secondary" | "primary" | "foreground";
  assetPath: string;
  x: number;
  y: number;
  widthPercent: number;
  zIndex: number;
  delayFrames: number;
  entrance: "none" | "rise" | "left" | "right";
};
export type CredentialedShot = {
  id: string;
  durationInFrames: 180;
  camera: { startScale: number; endScale: number; startX: number; endX: number; startY: number; endY: number };
  layers: CredentialedLayer[];
};
export type CredentialedBeat = { id: string; narration: string; subtitle: string; audioPath: string; narrationArtifactId: string; shots: [CredentialedShot, CredentialedShot] };
export type RenderRequest = { durationInFrames: number; fps: 30; width: 1080; height: 1920 };
export type CredentialedRomeResult = {
  beats: CredentialedBeat[];
  imageArtifactIds: string[];
  artifacts: CredentialedArtifact[];
  finalArtifact: CredentialedArtifact;
  traceFromRenderToSources: string[];
  renderRequest: RenderRequest;
};
export type CredentialedRomeInput = { config: CredentialedConfig; languageModel: LanguageModelProvider; imageProvider: ImageGenerationProvider; ttsProvider: TtsProvider; outputDirectory: string };

const beatIds = ["beat-01", "beat-02", "beat-03", "beat-04", "beat-05"] as const;
const sourceIds = ["rome-vi-source-rome-foundation", "rome-vi-source-roman-empire", "rome-vi-source-late-antiquity"] as const;
const layerRules = {
  background: "vertical 9:16 Vietnamese historical paper collage environment only, no people, no text, no watermark",
  primary: "one full-body main historical character on pure chroma green, white cut-paper outline, no text, no shadow",
  secondary: "one supporting full-body historical character on pure chroma green, white cut-paper outline, no text, no shadow",
  tertiary: "small distant full-body supporting historical character on pure chroma green, white cut-paper outline, no text, no shadow",
  foreground: "paper scraps and a foreground prop on pure chroma green, no text, no watermark"
} as const;
const layerLayout = {
  background: { x: 50, y: 50, widthPercent: 100, zIndex: 0, delayFrames: 0, entrance: "none" },
  tertiary: { x: 72, y: 42, widthPercent: 24, zIndex: 2, delayFrames: 30, entrance: "right" },
  secondary: { x: 21, y: 52, widthPercent: 36, zIndex: 3, delayFrames: 18, entrance: "left" },
  primary: { x: 50, y: 54, widthPercent: 54, zIndex: 5, delayFrames: 4, entrance: "rise" },
  foreground: { x: 50, y: 79, widthPercent: 108, zIndex: 7, delayFrames: 46, entrance: "rise" }
} as const;

const imagePrompt = (narration: string, shotId: string, role: keyof typeof layerRules): string =>
  `Scene ${shotId}. Vietnamese narration context: ${narration}. ${layerRules[role]}. Handmade layered paper cutout style, strong silhouette and clear depth.`;

export const runCredentialedRome = async (input: CredentialedRomeInput): Promise<CredentialedRomeResult> => {
  const script = await input.languageModel.generateStructured({
    model: input.config.llmModel,
    schema: LocalizedScriptSchema,
    promptTemplateRef: { id: "localized-script", version: 1 },
    language: "vi-VN",
    system: "Write factual Vietnamese narration as strict JSON.",
    user: 'Create exactly five concise Vietnamese Rome beats. Return only {"language":"vi-VN","scenes":[{"id":"beat-01","narration":"…"}]}. Use beat-01 through beat-05 in order. Each narration is 25 to 35 Vietnamese words and covers Rome from republic to legacy.'
  });
  if (script.scenes.length !== beatIds.length || script.scenes.some((scene, index) => scene.id !== beatIds[index])) throw new Error("local LLM must return five Rome beats named beat-01 through beat-05");

  const assetsDirectory = join(input.outputDirectory, "assets");
  const audioDirectory = join(input.outputDirectory, "audio");
  await Promise.all([mkdir(assetsDirectory, { recursive: true }), mkdir(audioDirectory, { recursive: true })]);
  const artifacts: CredentialedArtifact[] = sourceIds.map((id) => ({ id, kind: "ResearchSource", inputArtifactIds: [], metadata: { locale: "vi-VN" } }));
  const factPackage: CredentialedArtifact = { id: "rome-vi-facts", kind: "FactPackage", inputArtifactIds: [...sourceIds], metadata: { provider: input.config.llmProvider, model: input.config.llmModel } };
  const localizedScript: CredentialedArtifact = { id: "rome-vi-script", kind: "LocalizedScript", inputArtifactIds: [factPackage.id], metadata: { language: "vi-VN" } };
  const storyboard: CredentialedArtifact = { id: "rome-vi-storyboard", kind: "DirectorStoryboard", inputArtifactIds: [localizedScript.id], metadata: { styleProfileId: "paper-collage" } };
  artifacts.push(factPackage, localizedScript, storyboard);

  const beats: CredentialedBeat[] = [];
  const imageArtifactIds: string[] = [];
  for (const beat of script.scenes) {
    const sourceShotId = `${beat.id}-wide`;
    const directory = join(assetsDirectory, sourceShotId);
    await mkdir(directory, { recursive: true });
    const sourceLayers: Array<Omit<CredentialedLayer, "id"> & { role: CredentialedLayer["role"] }> = [];
    for (const role of ["background", "tertiary", "secondary", "primary", "foreground"] as const) {
      const assetPath = join(directory, `${role}.png`);
      if (!existsSync(assetPath)) {
        const image = await input.imageProvider.generate({ prompt: imagePrompt(beat.narration, sourceShotId, role), negativePrompt: "text, watermark, logo, cropped body", alphaRequired: role !== "background", aspectRatio: "9:16" });
        await writeFile(assetPath, role === "background" ? await normalizeAssetCanvas(image.bytes) : await removeGreenScreen(image.bytes));
      }
      const assetId = `rome-vi-${beat.id}-${role}`;
      artifacts.push({ id: assetId, kind: "ApprovedAsset", inputArtifactIds: [storyboard.id], metadata: { path: assetPath, provider: input.config.imageProvider, model: input.config.imageModel, role } });
      imageArtifactIds.push(assetId);
      sourceLayers.push({ role, assetPath, ...layerLayout[role] });
    }
    const shots: CredentialedShot[] = [];
    for (const view of ["wide", "detail"] as const) {
      const id = `${beat.id}-${view}`;
      const layers = sourceLayers.map((layer) => ({ ...layer, id: `${id}-${layer.role}` }));
      shots.push({ id, durationInFrames: 180, camera: view === "wide" ? { startScale: 1, endScale: 1.025, startX: 0, endX: -12, startY: 0, endY: 4 } : { startScale: 1.04, endScale: 1.1, startX: 12, endX: -8, startY: -4, endY: 8 }, layers });
    }
    const audio = await input.ttsProvider.synthesize({ text: beat.narration, language: "vi-VN", voiceId: String(input.config.capcutTtsVoiceIndex) });
    const audioPath = join(audioDirectory, `${beat.id}.mp3`);
    await writeFile(audioPath, audio.bytes);
    const narrationArtifactId = `rome-vi-narration-${beat.id}`;
    artifacts.push({ id: narrationArtifactId, kind: "NarrationClip", inputArtifactIds: [localizedScript.id], metadata: { path: audioPath, provider: "capcut", voiceIndex: input.config.capcutTtsVoiceIndex, durationMs: audio.durationMs } });
    beats.push({ id: beat.id, narration: beat.narration, subtitle: beat.narration, audioPath, narrationArtifactId, shots: shots as [CredentialedShot, CredentialedShot] });
  }

  const render: CredentialedArtifact = { id: "rome-vi-render", kind: "Render", inputArtifactIds: [storyboard.id, ...imageArtifactIds, ...beats.map((beat) => beat.narrationArtifactId)], metadata: { width: 1080, height: 1920, fps: 30 } };
  const qa: CredentialedArtifact = { id: "rome-vi-qa", kind: "QAReport", inputArtifactIds: [render.id], metadata: { status: "pending-render-verification" } };
  const publishing: CredentialedArtifact = { id: "rome-vi-publishing", kind: "PublishingPackage", inputArtifactIds: [qa.id], metadata: { language: "vi-VN", styleProfileId: "paper-collage" } };
  artifacts.push(render, qa, publishing);
  return { beats, imageArtifactIds, artifacts, finalArtifact: publishing, traceFromRenderToSources: [render.id, storyboard.id, localizedScript.id, factPackage.id, ...sourceIds], renderRequest: { durationInFrames: 1800, fps: 30, width: 1080, height: 1920 } };
};
