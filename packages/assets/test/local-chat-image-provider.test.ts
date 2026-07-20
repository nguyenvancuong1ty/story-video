import { Buffer } from "node:buffer";
import { expect, it } from "vitest";
import { LocalChatImageProvider } from "../src/local-chat-image-provider.js";

it("sends image modalities and decodes the Markdown data URL", async () => {
  const provider = new LocalChatImageProvider({ baseUrl: "http://localhost:20128/v1", model: "ag/gemini-3.1-flash-image" }, async (_url, init) => {
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "ag/gemini-3.1-flash-image", modalities: ["image", "text"] });
    return new Response(JSON.stringify({ choices: [{ message: { content: "![image](data:image/jpeg;base64,aW1hZ2U=)" } }] }));
  });
  await expect(provider.generate({ prompt: "Rome", negativePrompt: "", alphaRequired: false, aspectRatio: "9:16" })).resolves.toMatchObject({ bytes: Buffer.from("image"), mimeType: "image/jpeg" });
});

it("reports HTTP status without provider body", async () => {
  const provider = new LocalChatImageProvider({ baseUrl: "http://localhost:20128/v1", model: "m", maxRetries: 0 }, async () => new Response("secret", { status: 429 }));
  await expect(provider.generate({ prompt: "Rome", negativePrompt: "", alphaRequired: false, aspectRatio: "9:16" })).rejects.toThrow("Local image generation failed: 429");
});
