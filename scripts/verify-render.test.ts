import { expect, it } from "vitest";

import { resolveFfprobeExecutable, verifyRender } from "./verify-render.js";

it("uses the project-local ffprobe fallback when no override is supplied", () => {
  expect(resolveFfprobeExecutable({})).toContain("ffprobe");
});

it("rejects a file without an audio stream", async () => {
  await expect(
    verifyRender("fixtures/no-audio.mp4", async () => ({
      streams: [{ codec_type: "video", width: 1080, height: 1920, r_frame_rate: "30/1" }],
      format: { duration: "3" }
    }))
  ).rejects.toThrow("Missing audio stream");
});
