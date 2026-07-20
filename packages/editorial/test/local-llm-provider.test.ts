import { expect, it } from "vitest";

import { LocalizedScriptSchema } from "../src/script.js";
import { LocalOpenAiCompatibleProvider } from "../src/local-llm-provider.js";

it("parses a local chat-completion JSON response with the configured model", async () => {
  const provider = new LocalOpenAiCompatibleProvider("http://localhost:20128/v1", "cx/gpt-5.6-terra", async (_url, init) => {
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "cx/gpt-5.6-terra",
      response_format: { type: "json_object" }
    });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"language":"ja-JP","scenes":[]}' } }] }));
  });

  await expect(
    provider.generateStructured({
      model: "",
      schema: LocalizedScriptSchema,
      promptTemplateRef: { id: "localized-script", version: 1 },
      language: "ja-JP",
      system: "system",
      user: "user"
    })
  ).resolves.toMatchObject({ language: "ja-JP" });
});

it("rejects a local completion with no JSON content", async () => {
  const provider = new LocalOpenAiCompatibleProvider("http://localhost:20128/v1", "cx/gpt-5.6-terra", async () => new Response(JSON.stringify({ choices: [] })));
  await expect(
    provider.generateStructured({ model: "", schema: LocalizedScriptSchema, promptTemplateRef: { id: "localized-script", version: 1 }, language: "ja-JP", system: "", user: "" })
  ).rejects.toThrow("local LLM response did not include structured content");
});
