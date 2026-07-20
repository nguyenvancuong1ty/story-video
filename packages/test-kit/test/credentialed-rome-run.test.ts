import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { ImageGenerationInput, ImageGenerationProvider, ImageGenerationResult } from "../../assets/src/provider.js";
import type { TtsInput, TtsProvider, TtsResult } from "../../audio/src/provider.js";
import type { LanguageModelProvider } from "../../editorial/src/provider.js";
import { loadCredentialedConfig } from "../src/credentialed/config.js";
import { runCredentialedRome } from "../src/credentialed/rome-run.js";

const fixturePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGD4DwABBAEA0e4RZQAAAABJRU5ErkJggg==", "base64");
class ImageProvider implements ImageGenerationProvider { readonly calls: ImageGenerationInput[] = []; async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> { this.calls.push(input); return { bytes: fixturePng, mimeType: "image/png", providerAssetId: String(this.calls.length) }; } }
class TtsProviderFake implements TtsProvider { readonly calls: TtsInput[] = []; async synthesize(input: TtsInput): Promise<TtsResult> { this.calls.push(input); return { bytes: Buffer.from("audio"), mimeType: "audio/mpeg", durationMs: 12_000 }; } }

it("creates five Vietnamese beats with wide/detail layered shots", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ksvf-rome-")); const imageProvider = new ImageProvider(); const ttsProvider = new TtsProviderFake();
  const languageModel: LanguageModelProvider = { async generateStructured(input) { return input.schema.parse({ language: "vi-VN", scenes: Array.from({ length: 5 }, (_, index) => ({ id: `beat-0${index + 1}`, narration: `Đây là lời dẫn tiếng Việt về La Mã số ${index + 1}, giải thích quyền lực, công dân, quân đội và di sản còn lại.` })) }); } };
  try {
    const result = await runCredentialedRome({ config: loadCredentialedConfig({ LOCAL_IMAGE_MODEL: "ag/gemini-3.1-flash-image" }), languageModel, imageProvider, ttsProvider, outputDirectory });
    expect(result.beats).toHaveLength(5); expect(result.beats[0]?.shots.map((shot) => shot.id)).toEqual(["beat-01-wide", "beat-01-detail"]);
    expect(result.beats.flatMap((beat) => beat.shots).every((shot) => shot.layers.map((layer) => layer.role).join(",") === "background,tertiary,secondary,primary,foreground")).toBe(true);
    expect(imageProvider.calls).toHaveLength(25); expect(ttsProvider.calls).toHaveLength(5); expect(result.renderRequest.durationInFrames).toBe(1800); expect(result.finalArtifact.kind).toBe("PublishingPackage");
    const second = await runCredentialedRome({ config: loadCredentialedConfig({ LOCAL_IMAGE_MODEL: "ag/gemini-3.1-flash-image" }), languageModel, imageProvider, ttsProvider, outputDirectory });
    expect(second.beats).toHaveLength(5); expect(imageProvider.calls).toHaveLength(25);
  } finally { await rm(outputDirectory, { recursive: true, force: true }); }
});
