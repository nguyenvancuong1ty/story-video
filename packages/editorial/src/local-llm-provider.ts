import type { LanguageModelProvider, StructuredPrompt } from "./provider.js";

type Fetcher = typeof fetch;
type ChatPayload = { choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }> };

const parsePayload = async (response: Response): Promise<ChatPayload> => {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed.startsWith("data:")) return JSON.parse(trimmed) as ChatPayload;

  let content = "";
  let finalPayload: ChatPayload = {};
  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    const payload = JSON.parse(data) as ChatPayload;
    finalPayload = payload;
    const chunk = payload.choices?.[0]?.delta?.content ?? payload.choices?.[0]?.message?.content;
    if (chunk) content += chunk;
  }
  return content ? { choices: [{ message: { content } }] } : finalPayload;
};

export class LocalOpenAiCompatibleProvider implements LanguageModelProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultModel: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly apiKey?: string
  ) {}

  async generateStructured<T>(input: StructuredPrompt<T>): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: input.model || this.defaultModel,
        messages: [{ role: "system", content: input.system }, { role: "user", content: input.user }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) throw new Error(`local LLM request failed: ${response.status}`);
    const payload = await parsePayload(response);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("local LLM response did not include structured content");
    const normalized = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return input.schema.parse(JSON.parse(normalized));
  }
}
