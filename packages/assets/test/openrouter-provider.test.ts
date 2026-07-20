import { Buffer } from "node:buffer";

import { expect, it } from "vitest";

import { OpenRouterImageProvider } from "../src/openrouter-provider.js";

it("decodes OpenRouter b64_json into a PNG asset", async () => {
  const provider = new OpenRouterImageProvider({ apiKey: "secret", model: "image-model" }, async (_url, init) => {
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "image-model",
      n: 1,
      aspect_ratio: "9:16"
    });
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("quality");
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("output_format");
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("background");
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
  const provider = new OpenRouterImageProvider({ apiKey: "secret", model: "image-model" }, async () => new Response(JSON.stringify({ error: { message: "unsupported parameter: quality" } }), { status: 429 }));
  await expect(provider.generate({ prompt: "rome", negativePrompt: "", alphaRequired: false, aspectRatio: "9:16" })).rejects.toThrow("OpenRouter image generation failed: 429: unsupported parameter: quality");
});

it("uses curl transport when Node fetch is blocked by the image gateway", async () => {
  const calls: string[][] = [];
  const provider = new OpenRouterImageProvider(
    { apiKey: "secret", model: "image-model", transport: "curl" },
    fetch,
    async (arguments_) => {
      calls.push(arguments_);
      return { stdout: JSON.stringify({ data: [{ b64_json: Buffer.from("png").toString("base64") }] }) };
    }
  );

  await expect(provider.generate({ prompt: "rome", negativePrompt: "", alphaRequired: false, aspectRatio: "9:16" })).resolves.toMatchObject({ bytes: Buffer.from("png") });
  expect(calls[0]).toEqual(expect.arrayContaining(["--request", "POST", "https://openrouter.ai/api/v1/images"]));
});
