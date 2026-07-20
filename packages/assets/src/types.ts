export type AssetStatus = "PLANNED" | "PROMPT_READY" | "GENERATING" | "GENERATED" | "PROCESSING" | "VALIDATING" | "APPROVED" | "FAILED";

export type AssetGenerationFingerprint = {
  normalizedPrompt: string;
  negativePrompt: string;
  referenceAssetHashes: string[];
  provider: string;
  model: string;
  modelParameters: Record<string, unknown>;
  styleProfileRef: { id: string; version: number };
  aspectRatio: string;
  alphaRequired: boolean;
};

export type AssetJob = {
  assetId: string;
  sceneId: string;
  layerId: string;
  assetType: "generated-image" | "library-image";
  alphaRequired: boolean;
  cacheKey?: string;
};

export type ResolvedStoryboard = {
  storyboardArtifactId: string;
  layers: Array<{ sceneId: string; layerId: string; approvedAssetId: string }>;
};

export type PlannedAsset = {
  assetId: string;
  sceneId: string;
  layerId: string;
  type: string;
  alphaRequired: boolean;
  status: AssetStatus;
  prompt?: string;
  negativePrompt?: string;
};
