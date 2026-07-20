export type ResearchSource = {
  id: string;
  providerSourceId: string;
  title: string;
  url: string;
  excerpt: string;
  publishedAt?: string;
  retrievedAt: string;
};

export type ResearchQuery = { query: string; language: string; limit: number };

export interface ResearchProvider {
  search(input: ResearchQuery): Promise<ResearchSource[]>;
}

export type OpenAiResponsesTransport = {
  responses: {
    create(input: Record<string, unknown>): Promise<{ output_text?: string; output?: unknown[] }>;
  };
};

export class OpenAiWebSearchResearchProvider implements ResearchProvider {
  constructor(private readonly client: OpenAiResponsesTransport, private readonly model: string) {}

  async search(input: ResearchQuery): Promise<ResearchSource[]> {
    const response = await this.client.responses.create({
      model: this.model,
      input: `Research in ${input.language}: ${input.query}`,
      tools: [{ type: "web_search_preview" }]
    });
    const citations = response.output
      ?.flatMap((item) => {
        const outputItem = item as { content?: Array<{ text?: string; annotations?: Array<{ url?: string; title?: string }> }> };
        return outputItem.content ?? [];
      })
      .flatMap((content) => content.annotations?.map((annotation) => ({ ...annotation, excerpt: content.text ?? "" })) ?? [])
      .filter((annotation): annotation is { url: string; title?: string; excerpt: string } => Boolean(annotation.url));

    if (!citations?.length) {
      throw new Error("web search returned no citations");
    }

    return citations.slice(0, input.limit).map((citation, index) => ({
      id: `openai:${index}:${citation.url}`,
      providerSourceId: citation.url,
      title: citation.title ?? input.query,
      url: citation.url,
      excerpt: citation.excerpt,
      retrievedAt: new Date().toISOString()
    }));
  }
}

export class FakeResearchProvider implements ResearchProvider {
  constructor(private readonly sources: ResearchSource[]) {}

  async search(input: ResearchQuery): Promise<ResearchSource[]> {
    return this.sources.slice(0, input.limit).map((source) => ({ ...source }));
  }
}
