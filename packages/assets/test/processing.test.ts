import sharp from "sharp";
import { expect, it } from "vitest";
import { removeGreenScreen } from "../src/processing.js";

it("removes chroma green while keeping an opaque red subject", async () => {
  const source = await sharp({ create: { width: 2, height: 1, channels: 3, background: "#00ff00" } }).composite([{ input: { create: { width: 1, height: 1, channels: 4, background: "#ff0000" } }, left: 1, top: 0 }]).png().toBuffer();
  const output = await removeGreenScreen(source);
  const { data } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(data[3]).toBe(0); expect(data[7]).toBe(255);
});
