import { expect, it } from "vitest";

import { CharacterProfileSchema, CharacterRegistrySchema } from "../src/index.js";

it("validates a reusable character profile", () => {
  const character = CharacterProfileSchema.parse({
    id: "character-caesar",
    name: "Julius Caesar",
    aliases: ["Caesar"],
    appearance: { face: "angular", hair: "short dark", distinctiveTraits: ["laurel wreath"] },
    costumes: [],
    canonicalReferenceAssetIds: [],
    promptAnchors: ["Roman statesman"],
    negativeAnchors: ["modern clothing"],
    cultureTags: ["Roman"],
    periodTags: ["1st century BCE"]
  });

  expect(CharacterRegistrySchema.parse({ projectId: "prj_1", characters: [character] }).characters).toHaveLength(1);
});
