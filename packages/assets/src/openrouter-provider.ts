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
    const url = `${baseUrl}/images`;
    const body = JSON.stringify({
      model: this.options.model,
      prompt: input.negativePrompt.trim() ? `${input.prompt}\nAvoid: ${input.negativePrompt}` : input.prompt,
      n: 1,
      aspect_ratio: input.aspectRatio,
      output_format: "png",
      background: input.alphaRequired ? "transparent" : "opaque",
      quality: "low"
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
    const data = payload as { data?: Array<{ b64_json?: string }> };
    const b64Json = data.data?.[0]?.b64_json;
    if (!b64Json) throw new Error("OpenRouter image generation returned no image data");
    return { bytes: Buffer.from(b64Json, "base64"), mimeType: "image/png", providerAssetId: "openrouter-image-0" };
  }
}
