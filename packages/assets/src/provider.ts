export type ImageGenerationInput = { prompt: string; negativePrompt: string; alphaRequired: boolean; aspectRatio: string };
export type ImageGenerationResult = { bytes: Buffer; mimeType: string; providerAssetId: string };

export interface ImageGenerationProvider {
  generate(input: ImageGenerationInput): Promise<ImageGenerationResult>;
}

export class FakeImageProvider implements ImageGenerationProvider {
  constructor(private readonly result: ImageGenerationResult) {}

  async generate(): Promise<ImageGenerationResult> {
    return { ...this.result, bytes: Buffer.from(this.result.bytes) };
  }
}
