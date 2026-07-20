import { expect, it } from "vitest";

import { SceneSpecSchema } from "../src/index.js";

const layer = {
  id: "scene-01-primary",
  role: "primary",
  subject: "Julius Caesar",
  characterId: "character-caesar",
  assetType: "generated-image",
  generation: { promptIntent: "Roman leader, paper-cut portrait", transparentBackground: true, referenceAssetIds: [] },
  layout: { anchorX: 0.5, anchorY: 0.62, widthPercent: 44, scale: 1, rotation: -2, zIndex: 5 },
  motion: { preset: "primary-entrance", startFrame: 6, intensity: 0.7 }
};

const scene = {
  id: "scene-01",
  narrativeBeat: "Caesar enters the Senate",
  primarySubject: "Julius Caesar",
  layers: [
    {
      ...layer,
      id: "scene-01-background",
      role: "background",
      subject: "Roman Senate",
      generation: { promptIntent: "Roman Senate interior", transparentBackground: false, referenceAssetIds: [] },
      layout: { ...layer.layout, zIndex: 0 }
    },
    layer
  ],
  camera: { preset: "push-in", direction: "center", startScale: 1, endScale: 1.08, startX: 0, endX: -40, startY: 0, endY: 15, easing: "ease-in-out" },
  subtitleSafeArea: { edge: "bottom", insetPercent: 18 }
};

it("accepts a fully directed layered scene", () => {
  expect(SceneSpecSchema.parse(scene)).toEqual(scene);
});

it("rejects duplicate z-index and missing primary layers", () => {
  expect(() => SceneSpecSchema.parse({ ...scene, layers: [...scene.layers, { ...layer, id: "duplicate", layout: { ...layer.layout } }] })).toThrow("duplicate z-index");
  expect(() => SceneSpecSchema.parse({ ...scene, layers: [scene.layers[0], { ...scene.layers[0], id: "secondary", role: "secondary", layout: { ...scene.layers[0].layout, zIndex: 3 } }] })).toThrow("scene requires a primary layer");
});
