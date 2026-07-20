import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import type { LanguageModelProvider } from "../../editorial/src/provider.js";
import type { ImageGenerationInput, ImageGenerationProvider, ImageGenerationResult } from "../../assets/src/provider.js";
import type { TtsInput, TtsProvider, TtsResult } from "../../audio/src/provider.js";
import { loadCredentialedConfig } from "../src/credentialed/config.js";
import { runCredentialedRome } from "../src/credentialed/rome-run.js";

class CountingImageProvider implements ImageGenerationProvider {
  readonly calls: ImageGenerationInput[] = [];

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    this.calls.push(input);
    return { bytes: Buffer.from(`image-${this.calls.length}`), mimeType: "image/png", providerAssetId: `image-${this.calls.length}` };
  }
}

class CountingTtsProvider implements TtsProvider {
  readonly calls: TtsInput[] = [];

  async synthesize(input: TtsInput): Promise<TtsResult> {
    this.calls.push(input);
    return { bytes: Buffer.from(`audio-${this.calls.length}`), mimeType: "audio/mpeg", durationMs: 10_000 };
  }
}

it("builds six scenes and never requests more than six images", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ksvf-rome-"));
  const imageProvider = new CountingImageProvider();
  const ttsProvider = new CountingTtsProvider();
  const prompts: string[] = [];
  const languageModel: LanguageModelProvider = {
    async generateStructured(input) {
      prompts.push(input.user);
      return input.schema.parse({
        language: "ja-JP",
        scenes: Array.from({ length: 6 }, (_, index) => ({ id: `scene-0${index + 1}`, narration: `ナレーション ${index + 1}` }))
      });
    }
  };

  try {
    const result = await runCredentialedRome({
      config: loadCredentialedConfig({ OPENROUTER_API_KEY: "secret", OPENROUTER_IMAGE_MODEL: "image-model" }),
      languageModel,
      imageProvider,
      ttsProvider,
      outputDirectory
    });

    expect(result.scenes).toHaveLength(6);
    expect(result.imageArtifactIds).toHaveLength(6);
    expect(result.generatedImageCount).toBe(6);
    expect(imageProvider.calls).toHaveLength(6);
    expect(ttsProvider.calls).toHaveLength(6);
    expect(result.renderRequest.durationInFrames).toBe(1800);
    expect(prompts[0]).toContain('{"language":"ja-JP","scenes":[{"id":"scene-01","narration":"…"}]}');
    expect(result.scenes[0]?.scene.layers).toEqual(expect.arrayContaining([expect.objectContaining({ role: "primary", assetType: "generated-image" })]));
    await expect(readFile(join(outputDirectory, "assets", "scene-01.png"), "utf8")).resolves.toBe("image-1");
    expect(result.finalArtifact.kind).toBe("PublishingPackage");
    expect(result.traceFromRenderToSources).toContain("rome-ja-source-rome-foundation");
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
