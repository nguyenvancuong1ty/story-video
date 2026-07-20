import { z } from "zod";

export const AssetReferenceSchema = z.object({
  id: z.string().min(1),
  mimeType: z.string().min(1),
  url: z.string().url(),
  hasAlpha: z.boolean().optional()
});

export type AssetReference = z.infer<typeof AssetReferenceSchema>;
