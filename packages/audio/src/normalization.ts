import type { PronunciationEntry } from "./pronunciation.js";

export const normalizeForSpeech = (text: string, language: string, pronunciations: PronunciationEntry[]): string => {
  if (language !== "ja-JP") return text;

  return pronunciations.reduce((normalized, entry) => normalized.split(entry.surface).join(entry.reading), text);
};
