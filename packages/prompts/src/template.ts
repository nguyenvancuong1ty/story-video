import { z } from "zod";

export const PromptTemplateSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  domain: z.enum(["research", "fact-check", "editorial-angle", "localization", "script", "storyboard", "image", "review"]),
  systemTemplate: z.string(),
  userTemplate: z.string(),
  outputSchemaVersion: z.string().min(1),
  modelDefaults: z.record(z.unknown()),
  createdAt: z.string().datetime()
});

export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;
export type PromptTemplateRef = Pick<PromptTemplate, "id" | "version">;
