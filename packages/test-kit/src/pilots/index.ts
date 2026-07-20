import { AssetCache, computeAssetCacheKey } from "../../../assets/src/index.js";
import { TelemetryCollector, type ProjectTelemetry } from "../../../orchestration/src/index.js";

export type PilotFixture = {
  id: "rome-ja" | "pompeii-ja" | "pyramids-ja";
  topic: string;
  characterName: string;
};

export type PilotArtifact = {
  id: string;
  kind: string;
  inputArtifactIds: string[];
  metadata: Record<string, unknown>;
};

export type PilotResult = {
  artifacts: PilotArtifact[];
  finalArtifact: PilotArtifact;
  traceFromRenderToSources: string[];
  telemetry: ProjectTelemetry;
};

const styleMetadata = { styleProfileId: "paper-collage", styleProfileVersion: 1 };
const promptMetadata = { promptTemplateId: "storyboard-director", promptTemplateVersion: 1 };

const createPilot = (id: PilotFixture["id"], topic: string, characterName: string): PilotFixture => ({ id, topic, characterName });

export const createRomeJapanesePilot = (): PilotFixture => createPilot("rome-ja", "The fall of Rome", "Julius Caesar");
export const createPompeiiJapanesePilot = (): PilotFixture => createPilot("pompeii-ja", "The disappearance of Pompeii", "Pliny the Younger");
export const createPyramidsJapanesePilot = (): PilotFixture => createPilot("pyramids-ja", "Pyramid construction", "Khufu");

export const runPilot = async (pilot: PilotFixture): Promise<PilotResult> => {
  const projectId = `pilot-${pilot.id}`;
  const source = { id: `${projectId}-source`, kind: "FactPackage", inputArtifactIds: [], metadata: { sourceUrl: `https://example.com/${pilot.id}`, ...promptMetadata } };
  const characters = { id: `${projectId}-characters`, kind: "CharacterRegistry", inputArtifactIds: [source.id], metadata: { characterId: `character-${pilot.id}`, name: pilot.characterName, ...styleMetadata } };
  const storyboard = { id: `${projectId}-storyboard`, kind: "DirectorStoryboard", inputArtifactIds: [source.id, characters.id], metadata: { ...promptMetadata, ...styleMetadata } };

  const fingerprint = {
    normalizedPrompt: `${pilot.topic} paper collage`,
    negativePrompt: "text, watermark",
    referenceAssetHashes: [`character-${pilot.id}`],
    provider: "fake-image",
    model: "fixture-v1",
    modelParameters: { quality: "high" },
    styleProfileRef: { id: "paper-collage", version: 1 },
    aspectRatio: "9:16",
    alphaRequired: true
  };
  const cache = new AssetCache();
  const telemetry = new TelemetryCollector();
  const cacheKey = computeAssetCacheKey(fingerprint);
  cache.put(cacheKey, { assetId: `${projectId}-asset`, status: "APPROVED", usageRightsCompatible: true });
  if (cache.get(cacheKey)) telemetry.recordAssetCacheHit();

  const approvedAsset = { id: `${projectId}-asset`, kind: "ApprovedAsset", inputArtifactIds: [storyboard.id], metadata: { cacheKey, layerId: "scene-01-primary", ...styleMetadata } };
  const render = { id: `${projectId}-render`, kind: "RenderPackage", inputArtifactIds: [storyboard.id, approvedAsset.id], metadata: { width: 1080, height: 1920, fps: 30, ...styleMetadata } };
  const publishing = { id: `${projectId}-publishing`, kind: "PublishingPackage", inputArtifactIds: [render.id], metadata: { language: "ja-JP", ...promptMetadata, ...styleMetadata } };
  telemetry.recordStage({ projectId, executionId: `${projectId}-run`, stage: "IMAGE_GENERATION", queueDelayMs: 0, durationMs: 1, provider: "fake-image", model: "fixture-v1", units: 1, childArtifactIds: [approvedAsset.id], recordedAt: "2026-07-20T00:00:00.000Z" });
  telemetry.recordCost({ projectId, executionId: `${projectId}-run`, stage: "IMAGE_GENERATION", provider: "fake-image", model: "fixture-v1", units: 1, amountUsd: 0, childArtifactIds: [approvedAsset.id], recordedAt: "2026-07-20T00:00:00.000Z" });

  return { artifacts: [source, characters, storyboard, approvedAsset, render, publishing], finalArtifact: publishing, traceFromRenderToSources: [render.id, storyboard.id, source.id], telemetry: telemetry.snapshot() };
};
