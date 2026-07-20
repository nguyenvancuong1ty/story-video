import { expect, it } from "vitest";

import { createRenderConfig, validateComposition } from "../src/index.js";

it("uses vertical h264 render settings", () => {
  expect(createRenderConfig()).toMatchObject({ width: 1080, height: 1920, fps: 30, codec: "h264" });
});

it("rejects composition without a primary layer", () => {
  expect(() => validateComposition({ layers: [{ id: "background", role: "background", zIndex: 0, assetType: "generated-image" }] })).toThrow("scene requires a primary layer");
});
