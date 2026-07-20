import { expect, it } from "vitest";

import { AssetService, computeAssetCacheKey, planAssetsFromStoryboard } from "../src/index.js";

const storyboard = {
  id: "storyboard_1",
  scenes: [
    {
      id: "scene-01",
      layers: [
        { id: "scene-01-background", role: "background", assetType: "generated-image", generation: { promptIntent: "Senate", transparentBackground: false, referenceAssetIds: [] } },
        { id: "scene-01-primary", role: "primary", assetType: "generated-image", generation: { promptIntent: "Caesar", transparentBackground: true, referenceAssetIds: [] } },
        { id: "scene-01-particles", role: "effect", assetType: "particle" }
      ]
    }
  ]
};

it("plans provider jobs per generated layer and preserves layer alpha intent", () => {
  const jobs = planAssetsFromStoryboard(storyboard);

  expect(jobs).toEqual(expect.arrayContaining([expect.objectContaining({ sceneId: "scene-01", layerId: "scene-01-primary", alphaRequired: true })]));
  expect(jobs.find((job) => job.layerId === "scene-01-background")).toMatchObject({ alphaRequired: false });
  expect(jobs).toHaveLength(2);
});

it("moves an asset through planning and prompt preparation", async () => {
  const service = new AssetService();
  const asset = await service.plan({ assetId: "asset-scene-03-character-01", layerId: "scene-03-primary", type: "character", sceneId: "scene-03", alphaRequired: true });

  expect(asset.status).toBe("PLANNED");
  await service.preparePrompt(asset.assetId, { prompt: "portrait", negativePrompt: "text, watermark" });
  await expect(service.get(asset.assetId)).resolves.toMatchObject({ status: "PROMPT_READY" });
});

it("creates exact deterministic cache keys", () => {
  const fingerprint = { normalizedPrompt: "portrait", negativePrompt: "text, watermark", referenceAssetHashes: ["ref-a"], provider: "openai", model: "image-model", modelParameters: { quality: "high" }, styleProfileRef: { id: "paper-collage", version: 1 }, aspectRatio: "9:16", alphaRequired: true };

  expect(computeAssetCacheKey(fingerprint)).toBe(computeAssetCacheKey({ ...fingerprint, modelParameters: { quality: "high" } }));
  expect(computeAssetCacheKey({ ...fingerprint, styleProfileRef: { id: "paper-collage", version: 2 } })).not.toBe(computeAssetCacheKey(fingerprint));
});
