import { expect, it } from "vitest";
import { getLayerTransform } from "../src/motion.js";

it("gives a primary layer a larger delayed rise than a tertiary layer", () => {
  expect(getLayerTransform({ role: "primary", entrance: "rise", delayFrames: 4, x: 50, y: 54, widthPercent: 54, zIndex: 5, id: "p", assetPath: "p.png" }, 4)).toContain("scale(0.86)");
  expect(getLayerTransform({ role: "tertiary", entrance: "right", delayFrames: 30, x: 72, y: 42, widthPercent: 24, zIndex: 2, id: "t", assetPath: "t.png" }, 30)).toContain("translate(38px, 0px)");
});
