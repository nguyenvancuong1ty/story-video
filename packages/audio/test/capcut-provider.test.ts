import { Buffer } from "node:buffer";

import { expect, it } from "vitest";

import { CapCutTtsProvider } from "../src/capcut-provider.js";

it("sends CapCut raw-TTS body and preserves MP3 bytes", async () => {
  const provider = new CapCutTtsProvider({ baseUrl: "http://127.0.0.1:8765", voiceIndex: 25, rate: "1.0", durationMs: 10_000 }, async (_url, init) => {
    expect(JSON.parse(String(init?.body))).toEqual({ text: "ローマ", voice_index: 25, rate: "1.0" });
    return new Response(Buffer.from("mp3"), { headers: { "content-type": "audio/mpeg" } });
  });

  await expect(provider.synthesize({ text: "ローマ", language: "ja-JP", voiceId: "ignored" })).resolves.toMatchObject({
    bytes: Buffer.from("mp3"),
    mimeType: "audio/mpeg",
    durationMs: 10_000
  });
});

it("rejects an empty CapCut response", async () => {
  const provider = new CapCutTtsProvider({ baseUrl: "http://127.0.0.1:8765", voiceIndex: 25, rate: "1.0", durationMs: 10_000 }, async () => new Response(Buffer.alloc(0)));
  await expect(provider.synthesize({ text: "ローマ", language: "ja-JP", voiceId: "ignored" })).rejects.toThrow("CapCut TTS returned empty audio");
});
