import type { z } from "zod";

export type PromptTemplateRef = { id: string; version: number };
export type StructuredPrompt<T> = {
  model: string;
  schema: z.ZodType<T>;
  promptTemplateRef: PromptTemplateRef;
  language: string;
  system: string;
  user: string;
};

export interface LanguageModelProvider {
  generateStructured<T>(input: StructuredPrompt<T>): Promise<T>;
}

export type OpenAiResponsesTransport = {
  responses: { create(input: Record<string, unknown>): Promise<{ output_text?: string }> };
};

export class OpenAiLanguageModelProvider implements LanguageModelProvider {
  constructor(private readonly client: OpenAiResponsesTransport, private readonly defaultModel: string) {}

  async generateStructured<T>(input: StructuredPrompt<T>): Promise<T> {
    const response = await this.client.responses.create({
      model: input.model || this.defaultModel,
      instructions: input.system,
      input: input.user,
      text: { format: { type: "json_object" } }
    });

    return input.schema.parse(JSON.parse(response.output_text ?? "{}"));
  }
}

export class FakeLanguageModelProvider implements LanguageModelProvider {
  constructor(private readonly response: unknown) {}

  async generateStructured<T>(input: StructuredPrompt<T>): Promise<T> {
    return input.schema.parse(this.response);
  }
}
