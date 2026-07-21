import type { LanguageModelProvider, StructuredPrompt } from "./provider.js";

type Fetcher = typeof fetch;

export class OpenRouterLanguageModelProvider implements LanguageModelProvider {
  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
    private readonly baseUrl = "https://openrouter.ai/api/v1",
    private readonly fetcher: Fetcher = fetch
  ) {}

  async generateStructured<T>(input: StructuredPrompt<T>): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: input.model || this.defaultModel,
        messages: [{ role: "system", content: input.system }, { role: "user", content: input.user }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) throw new Error(`OpenRouter LLM request failed: ${response.status}`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter LLM response did not include structured content");
    return input.schema.parse(JSON.parse(content));
  }
}
