import { z } from "zod";

export const VersionedReferenceSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive()
});

export const ProjectConfigSchema = z.object({
  contentDomain: z.string().min(1),
  topic: z.string().min(1),
  storyFormat: z.string().min(1),
  audience: z.string().min(1),
  presentation: z.string().min(1),
  truthPolicy: z.enum(["factual", "interpretive", "legendary", "fictional-alt-history"]),
  styleProfileRef: VersionedReferenceSchema
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
