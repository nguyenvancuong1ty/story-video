import { createHash } from "node:crypto";

export type CharacterRegistryEntry = {
  id: string;
  name: string;
  aliases: string[];
  canonicalReferenceAssetIds: string[];
  promptAnchors: string[];
  negativeAnchors: string[];
};

export type CharacterRegistry = { projectId: string; characters: CharacterRegistryEntry[] };
export type CharacterScript = { projectId: string; characters: Array<{ name: string; aliases?: string[] }> };

const characterKey = (name: string): string => name.trim().toLocaleLowerCase();

export const buildCharacterRegistry = (input: { script: CharacterScript; existingRegistry?: CharacterRegistry }): CharacterRegistry => {
  const existing = new Map((input.existingRegistry?.characters ?? []).map((character) => [characterKey(character.name), character]));

  return {
    projectId: input.script.projectId,
    characters: input.script.characters.map((character) => {
      const prior = existing.get(characterKey(character.name));

      return (
        prior ?? {
          id: `character-${createHash("sha256").update(`${input.script.projectId}:${characterKey(character.name)}`).digest("hex").slice(0, 12)}`,
          name: character.name,
          aliases: character.aliases ?? [],
          canonicalReferenceAssetIds: [],
          promptAnchors: [character.name],
          negativeAnchors: []
        }
      );
    })
  };
};
