import { z } from "zod";

export const CharacterProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  appearance: z.object({
    face: z.string().min(1),
    hair: z.string().min(1),
    ageRange: z.string().optional(),
    bodyType: z.string().optional(),
    distinctiveTraits: z.array(z.string())
  }),
  costumes: z.array(
    z.object({
      id: z.string().min(1),
      period: z.string().min(1),
      description: z.string().min(1),
      referenceAssetIds: z.array(z.string())
    })
  ),
  canonicalReferenceAssetIds: z.array(z.string()),
  promptAnchors: z.array(z.string()),
  negativeAnchors: z.array(z.string()),
  voiceProfileId: z.string().optional(),
  cultureTags: z.array(z.string()),
  periodTags: z.array(z.string())
});

export const CharacterRegistrySchema = z.object({
  projectId: z.string().min(1),
  characters: z.array(CharacterProfileSchema)
});

export type CharacterProfile = z.infer<typeof CharacterProfileSchema>;
export type CharacterRegistry = z.infer<typeof CharacterRegistrySchema>;
