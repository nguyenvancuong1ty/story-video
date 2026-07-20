import { Buffer } from "node:buffer";

import type { TtsInput, TtsProvider, TtsResult } from "./provider.js";

type CapCutTtsOptions = { baseUrl: string; voiceIndex: number; rate: string; durationMs: number };

export class CapCutTtsProvider implements TtsProvider {
  constructor(private readonly options: CapCutTtsOptions, private readonly fetcher: typeof fetch = fetch) {}

  async synthesize(input: TtsInput): Promise<TtsResult> {
    const response = await this.fetcher(`${this.options.baseUrl.replace(/\/+$/, "")}/api/tts/raw`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: input.text, voice_index: this.options.voiceIndex, rate: this.options.rate })
    });
    if (!response.ok) throw new Error(`CapCut TTS failed: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) throw new Error("CapCut TTS returned empty audio");
    return { bytes, mimeType: response.headers.get("content-type") ?? "audio/mpeg", durationMs: this.options.durationMs };
  }
}
