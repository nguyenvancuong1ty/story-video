import { Buffer } from "node:buffer";

import { expect, it } from "vitest";

import { OpenRouterImageProvider } from "../src/openrouter-provider.js";

it("decodes OpenRouter b64_json into a PNG asset", async () => {
  const provider = new OpenRouterImageProvider({ apiKey: "secret", model: "image-model" }, async (_url, init) => {
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "image-model",
      n: 1,
      output_format: "png",
      background: "transparent",
      quality: "low"
    });
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret");
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("png").toString("base64") }] }));
  });

  await expect(provider.generate({ prompt: "rome", negativePrompt: "text", alphaRequired: true, aspectRatio: "9:16" })).resolves.toMatchObject({
    bytes: Buffer.from("png"),
    mimeType: "image/png",
    providerAssetId: "openrouter-image-0"
  });
});

it("reports an image request failure without leaking credentials", async () => {
  const provider = new OpenRouterImageProvider({ apiKey: "secret", model: "image-model" }, async () => new Response("no", { status: 429 }));
  await expect(provider.generate({ prompt: "rome", negativePrompt: "", alphaRequired: false, aspectRatio: "9:16" })).rejects.toThrow("OpenRouter image generation failed: 429");
});
