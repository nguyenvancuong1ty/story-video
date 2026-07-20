import { Buffer } from "node:buffer";

import type { ImageGenerationInput, ImageGenerationProvider, ImageGenerationResult } from "./provider.js";

type OpenRouterImageOptions = { apiKey: string; model: string; baseUrl?: string };

export class OpenRouterImageProvider implements ImageGenerationProvider {
  constructor(private readonly options: OpenRouterImageOptions, private readonly fetcher: typeof fetch = fetch) {}

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const baseUrl = (this.options.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    const response = await this.fetcher(`${baseUrl}/images`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.options.model,
        prompt: input.negativePrompt.trim() ? `${input.prompt}\nAvoid: ${input.negativePrompt}` : input.prompt,
        n: 1,
        aspect_ratio: input.aspectRatio,
        output_format: "png",
        background: input.alphaRequired ? "transparent" : "opaque",
        quality: "low"
      })
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => ({}))) as { error?: { message?: unknown }; message?: unknown };
      const message = typeof errorPayload.error?.message === "string" ? errorPayload.error.message : typeof errorPayload.message === "string" ? errorPayload.message : "";
      throw new Error(`OpenRouter image generation failed: ${response.status}${message ? `: ${message.slice(0, 500)}` : ""}`);
    }
    const payload = (await response.json()) as { data?: Array<{ b64_json?: string }> };
    const b64Json = payload.data?.[0]?.b64_json;
    if (!b64Json) throw new Error("OpenRouter image generation returned no image data");
    return { bytes: Buffer.from(b64Json, "base64"), mimeType: "image/png", providerAssetId: "openrouter-image-0" };
  }
}
