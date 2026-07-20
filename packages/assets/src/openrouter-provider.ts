import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ImageGenerationInput, ImageGenerationProvider, ImageGenerationResult } from "./provider.js";

type OpenRouterImageOptions = { apiKey: string; model: string; baseUrl?: string; transport?: "fetch" | "curl" };
type CurlExecutor = (arguments_: string[]) => Promise<{ stdout: string }>;
const execFileAsync = promisify(execFile);

const errorMessage = (payload: unknown): string => {
  const value = payload as { error?: { message?: unknown }; message?: unknown };
  return typeof value?.error?.message === "string" ? value.error.message : typeof value?.message === "string" ? value.message : "";
};

export class OpenRouterImageProvider implements ImageGenerationProvider {
  constructor(
    private readonly options: OpenRouterImageOptions,
    private readonly fetcher: typeof fetch = fetch,
    private readonly curlExecutor: CurlExecutor = async (arguments_) => execFileAsync("curl", arguments_)
  ) {}

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const baseUrl = (this.options.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    const url = `${baseUrl}/chat/completions`;
    const body = JSON.stringify({
      model: this.options.model,
      messages: [{
        role: "user",
        content: [{
          type: "text",
          text: input.negativePrompt.trim() ? `${input.prompt}\nAvoid: ${input.negativePrompt}` : input.prompt
        }]
      }]
    });

    if (this.options.transport === "curl") return this.generateWithCurl(url, body);

    const response = await this.fetcher(url, {
      method: "POST",
      headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json" },
      body
    });

    if (!response.ok) {
      const message = errorMessage(await response.json().catch(() => ({})));
      throw new Error(`OpenRouter image generation failed: ${response.status}${message ? `: ${message.slice(0, 500)}` : ""}`);
    }
    return this.parseImagePayload(await response.json());
  }

  private async generateWithCurl(url: string, body: string): Promise<ImageGenerationResult> {
    let stdout: string;
    try {
      ({ stdout } = await this.curlExecutor(["--silent", "--show-error", "--fail-with-body", "--max-time", "120", "--request", "POST", url, "--header", `Authorization: Bearer ${this.options.apiKey}`, "--header", "content-type: application/json", "--data", body]));
    } catch (error) {
      const responseText = typeof (error as { stdout?: unknown }).stdout === "string" ? (error as { stdout: string }).stdout : "";
      let payload: unknown = {};
      try {
        payload = responseText ? JSON.parse(responseText) as unknown : {};
      } catch {
        // Some gateway failures return HTML; retain a safe provider-level error.
      }
      const message = errorMessage(payload);
      throw new Error(`OpenRouter image generation failed through curl${message ? `: ${message.slice(0, 500)}` : ""}`);
    }
    return this.parseImagePayload(JSON.parse(stdout) as unknown);
  }

  private parseImagePayload(payload: unknown): ImageGenerationResult {
    const response = payload as { choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }> };
    const imageUrl = response.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const dataUrl = imageUrl?.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!dataUrl) throw new Error("OpenRouter chat image generation returned no base64 image data");
    return { bytes: Buffer.from(dataUrl[2], "base64"), mimeType: dataUrl[1], providerAssetId: "openrouter-image-0" };
  }
}
