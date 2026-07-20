import { expect, it } from "vitest";

import { buildComposition } from "../src/index.js";

const scene = {
  id: "scene-01",
  camera: { preset: "push-in", direction: "center", startScale: 1, endScale: 1.08, startX: 0, endX: -40, startY: 0, endY: 15, easing: "ease-in-out" },
  layers: [
    { id: "scene-01-background", role: "background", assetType: "generated-image", layout: { zIndex: 0 }, motion: { preset: "background-parallax", startFrame: 0, intensity: 0.3 } },
    { id: "scene-01-primary", role: "primary", assetType: "generated-image", layout: { zIndex: 5 }, motion: { preset: "primary-entrance", startFrame: 6, intensity: 0.7 } },
    { id: "scene-01-dust", role: "effect", assetType: "particle", layout: { zIndex: 7 }, motion: { preset: "slow-drift", startFrame: 0, intensity: 0.2 } }
  ]
};

const resolvedStoryboard = {
  storyboardArtifactId: "storyboard_1",
  layers: [
    { sceneId: "scene-01", layerId: "scene-01-background", approvedAssetId: "asset-senate" },
    { sceneId: "scene-01", layerId: "scene-01-primary", approvedAssetId: "asset-caesar" }
  ]
};

const approvedAssets = [
  { id: "asset-senate", status: "APPROVED", hasAlpha: false },
  { id: "asset-caesar", status: "APPROVED", hasAlpha: true }
];

it("passes resolved asset, layout, motion, and camera intent into composition", () => {
  const composition = buildComposition({ scene, resolvedStoryboard, approvedAssets, narration: { id: "clip_1" }, subtitles: [] });

  expect(composition.layers).toEqual(expect.arrayContaining([expect.objectContaining({ id: "scene-01-primary", assetId: "asset-caesar", zIndex: 5, motion: { preset: "primary-entrance", startFrame: 6, intensity: 0.7 } })]));
  expect(composition.camera).toMatchObject({ preset: "push-in", startScale: 1, endScale: 1.08, endX: -40, endY: 15 });
  expect(composition.layers.find((layer) => layer.id === "scene-01-dust")).toMatchObject({ assetId: undefined });
});

it("rejects generated layers without approved bindings", () => {
  expect(() => buildComposition({ scene, resolvedStoryboard: { ...resolvedStoryboard, layers: [] }, approvedAssets, narration: { id: "clip_1" }, subtitles: [] })).toThrow("missing approved asset binding");
});
