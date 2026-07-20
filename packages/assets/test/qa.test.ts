import sharp from "sharp";
import { expect, it } from "vitest";

import { inspectAsset } from "../src/index.js";

it("accepts a high-resolution alpha asset", async () => {
  const image = await sharp({ create: { width: 2048, height: 2048, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.5 } } }).png().toBuffer();

  await expect(inspectAsset(image)).resolves.toMatchObject({ hasAlpha: true, width: 2048, issues: [] });
});
