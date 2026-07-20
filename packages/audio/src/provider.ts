export type TtsInput = { text: string; language: string; voiceId: string };
export type TtsResult = { bytes: Buffer; mimeType: string; durationMs: number };

export interface TtsProvider {
  synthesize(input: TtsInput): Promise<TtsResult>;
}

export class FakeTtsProvider implements TtsProvider {
  constructor(private readonly result: TtsResult) {}

  async synthesize(): Promise<TtsResult> {
    return { ...this.result, bytes: Buffer.from(this.result.bytes) };
  }
}

export class ElevenLabsTtsProvider implements TtsProvider {
  constructor(private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {}

  async synthesize(input: TtsInput): Promise<TtsResult> {
    const response = await this.fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}`, {
      method: "POST",
      headers: { "content-type": "application/json", "xi-api-key": this.apiKey },
      body: JSON.stringify({ text: input.text, model_id: "eleven_multilingual_v2" })
    });

    if (!response.ok) throw new Error(`ElevenLabs synthesis failed: ${response.status}`);

    return { bytes: Buffer.from(await response.arrayBuffer()), mimeType: response.headers.get("content-type") ?? "audio/mpeg", durationMs: 0 };
  }
}
