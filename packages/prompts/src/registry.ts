import type { PromptTemplate, PromptTemplateRef } from "./template.js";

export class PromptTemplateRegistry {
  private readonly templates = new Map<string, PromptTemplate>();

  constructor(templates: PromptTemplate[]) {
    for (const template of templates) {
      this.templates.set(`${template.id}:${template.version}`, template);
    }
  }

  resolve(reference: PromptTemplateRef): PromptTemplate {
    const template = this.templates.get(`${reference.id}:${reference.version}`);

    if (!template) {
      throw new Error(`prompt template not found: ${reference.id}@${reference.version}`);
    }

    return template;
  }
}
