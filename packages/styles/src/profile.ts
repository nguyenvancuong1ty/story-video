import { z } from "zod";

export const StyleProfileSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().min(1),
  visualLanguage: z.string().min(1),
  lineTreatment: z.string().min(1),
  texture: z.string().min(1),
  lighting: z.string().min(1),
  palette: z.array(z.string()).min(1),
  characterProportions: z.string().min(1),
  imagePromptPrefix: z.string().min(1),
  imagePromptSuffix: z.string().min(1),
  negativePrompt: z.array(z.string()),
  motionPresetSet: z.string().min(1),
  typographyPreset: z.string().min(1),
  transitionPresetSet: z.string().min(1)
});

export type StyleProfile = z.infer<typeof StyleProfileSchema>;
