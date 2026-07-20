import { expect, it } from "vitest";

import { buildCharacterRegistry } from "../src/index.js";

it("preserves stable character ids across script revisions", () => {
  const script = { projectId: "prj_1", characters: [{ name: "Julius Caesar", aliases: ["Caesar"] }] };
  const registry = buildCharacterRegistry({ script, existingRegistry: undefined });
  const next = buildCharacterRegistry({ script, existingRegistry: registry });

  expect(registry.characters[0]).toMatchObject({ name: "Julius Caesar", canonicalReferenceAssetIds: [], promptAnchors: ["Julius Caesar"] });
  expect(next.characters[0]?.id).toBe(registry.characters[0]?.id);
});
