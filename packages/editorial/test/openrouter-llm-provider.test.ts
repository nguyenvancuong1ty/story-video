import { expect, it } from "vitest";

import { OpenRouterLanguageModelProvider } from "../src/openrouter-llm-provider.js";
import { LocalizedScriptSchema } from "../src/script.js";

it("sends structured chat completions to OpenRouter", async () => {
  const provider = new OpenRouterLanguageModelProvider("secret", "openrouter/model", "https://openrouter.ai/api/v1", async (url, init) => {
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret");
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "openrouter/model", response_format: { type: "json_object" } });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"language":"vi-VN","scenes":[]}' } }] }));
  });

  await expect(provider.generateStructured({
    model: "",
    schema: LocalizedScriptSchema,
    promptTemplateRef: { id: "localized-script", version: 1 },
    language: "vi-VN",
    system: "system",
    user: "user"
  })).resolves.toMatchObject({ language: "vi-VN" });
});

it("reports an OpenRouter failure without exposing the API key", async () => {
  const provider = new OpenRouterLanguageModelProvider("secret", "model", "https://openrouter.ai/api/v1", async () => new Response("blocked", { status: 429 }));
  await expect(provider.generateStructured({ model: "", schema: LocalizedScriptSchema, promptTemplateRef: { id: "localized-script", version: 1 }, language: "vi-VN", system: "", user: "" })).rejects.toThrow("OpenRouter LLM request failed: 429");
});
