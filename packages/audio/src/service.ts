import { normalizeForSpeech } from "./normalization.js";
import type { PronunciationEntry } from "./pronunciation.js";
import type { TtsProvider } from "./provider.js";

export type NarrationClip = {
  id: string;
  sourceText: string;
  normalizedText: string;
  language: string;
  voiceId: string;
  durationMs: number;
  mimeType: string;
  status: "APPROVED";
};

export class TtsService {
  constructor(private readonly provider: TtsProvider) {}

  async synthesize(input: { id: string; text: string; language: string; voiceId: string; pronunciations: PronunciationEntry[] }): Promise<NarrationClip> {
    const normalizedText = normalizeForSpeech(input.text, input.language, input.pronunciations);
    const result = await this.provider.synthesize({ text: normalizedText, language: input.language, voiceId: input.voiceId });

    if (result.durationMs <= 0) throw new Error("TTS result has zero duration");

    return {
      id: input.id,
      sourceText: input.text,
      normalizedText,
      language: input.language,
      voiceId: input.voiceId,
      durationMs: result.durationMs,
      mimeType: result.mimeType,
      status: "APPROVED"
    };
  }
}
