import { expect, it } from "vitest";

import { FakeTtsProvider, TtsService } from "../src/index.js";

it("persists normalized source and provider media for a clip", async () => {
  const service = new TtsService(new FakeTtsProvider({ bytes: Buffer.from("audio"), mimeType: "audio/mpeg", durationMs: 4120 }));
  const clip = await service.synthesize({ id: "clip_1", text: "徳川家康", language: "ja-JP", voiceId: "voice_1", pronunciations: [{ surface: "徳川家康", reading: "とくがわ いえやす", language: "ja-JP" }] });

  expect(clip).toMatchObject({ normalizedText: "とくがわ いえやす", durationMs: 4120, status: "APPROVED" });
});
