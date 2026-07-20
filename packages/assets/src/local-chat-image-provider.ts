import { Buffer } from "node:buffer";

import type { ImageGenerationInput, ImageGenerationProvider, ImageGenerationResult } from "./provider.js";

type LocalChatImageOptions = { baseUrl: string; model: string; maxRetries?: number; retryDelayMs?: number };
const markdownDataUrl = /!\[[^\]]*\]\((data:([^;,]+);base64,([^\s)]+))\)/s;

export class LocalChatImageProvider implements ImageGenerationProvider {
  constructor(private readonly options: LocalChatImageOptions, private readonly fetcher: typeof fetch = fetch) {}

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    let response: Response | undefined;
    const maxRetries = this.options.maxRetries ?? 6;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      response = await this.fetcher(`${this.options.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.options.model, modalities: ["image", "text"], messages: [{ role: "user", content: [{ type: "text", text: input.negativePrompt ? `${input.prompt}\nAvoid: ${input.negativePrompt}` : input.prompt }] }] })
      });
      if (response.ok || response.status !== 429 || attempt === maxRetries) break;
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : this.options.retryDelayMs ?? 10_000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    if (!response || !response.ok) throw new Error(`Local image generation failed: ${response?.status ?? 0}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.message?.content;
    const match = typeof content === "string" ? content.match(markdownDataUrl) : null;
    if (!match) throw new Error("Local image generation returned no Markdown data image");
    return { bytes: Buffer.from(match[3], "base64"), mimeType: match[2], providerAssetId: "local-chat-image-0" };
  }
}
