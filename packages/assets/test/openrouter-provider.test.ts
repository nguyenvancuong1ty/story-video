import { Buffer } from "node:buffer";

import { expect, it } from "vitest";

import { OpenRouterImageProvider } from "../src/openrouter-provider.js";

it("sends an OpenRouter chat image request and decodes its data URL", async () => {
  const provider = new OpenRouterImageProvider({ apiKey: "secret", model: "image-model" }, async (url, init) => {
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "image-model",
      messages: [{ role: "user", content: [{ type: "text", text: "rome\nAvoid: text" }] }]
    });
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret");
    return new Response(JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${Buffer.from("png").toString("base64")}` } }] } }] }));
  });

  await expect(provider.generate({ prompt: "rome", negativePrompt: "text", alphaRequired: true, aspectRatio: "9:16" })).resolves.toMatchObject({
    bytes: Buffer.from("png"),
    mimeType: "image/png",
    providerAssetId: "openrouter-image-0"
  });
});

it("reports the OpenRouter status without exposing its credential", async () => {
  const provider = new OpenRouterImageProvider({ apiKey: "secret", model: "image-model" }, async () => new Response("blocked", { status: 429 }));
  await expect(provider.generate({ prompt: "rome", negativePrompt: "", alphaRequired: false, aspectRatio: "9:16" })).rejects.toThrow("OpenRouter image generation failed: 429");
});

it("decodes a Markdown image data URL when a provider omits message.images", async () => {
  const provider = new OpenRouterImageProvider({ apiKey: "secret", model: "image-model" }, async () => new Response(JSON.stringify({
    choices: [{ message: { content: `![image](data:image/png;base64,${Buffer.from("png").toString("base64")})` } }]
  })));
  await expect(provider.generate({ prompt: "rome", negativePrompt: "", alphaRequired: false, aspectRatio: "9:16" })).resolves.toMatchObject({ bytes: Buffer.from("png") });
});

it("uses curl transport for image gateways that do not work with fetch", async () => {
  const calls: string[][] = [];
  const provider = new OpenRouterImageProvider(
    { apiKey: "secret", model: "image-model", transport: "curl" },
    fetch,
    async (arguments_) => {
      calls.push(arguments_);
      return { stdout: JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${Buffer.from("png").toString("base64")}` } }] } }] }) };
    }
  );

  await expect(provider.generate({ prompt: "rome", negativePrompt: "", alphaRequired: false, aspectRatio: "9:16" })).resolves.toMatchObject({ bytes: Buffer.from("png") });
  expect(calls[0]).toEqual(expect.arrayContaining(["--request", "POST", "https://openrouter.ai/api/v1/chat/completions"]));
});
