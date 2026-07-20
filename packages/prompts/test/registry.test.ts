import { expect, it } from "vitest";

import { PromptTemplateRegistry, PromptTemplateSchema } from "../src/index.js";

it("resolves an immutable prompt template by id and version", () => {
  const template = PromptTemplateSchema.parse({
    id: "storyboard-director",
    version: 1,
    domain: "storyboard",
    systemTemplate: "system",
    userTemplate: "user",
    outputSchemaVersion: "1",
    modelDefaults: {},
    createdAt: "2026-07-19T00:00:00.000Z"
  });
  const registry = new PromptTemplateRegistry([template]);

  expect(registry.resolve({ id: "storyboard-director", version: 1 })).toEqual(template);
  expect(() => registry.resolve({ id: "storyboard-director", version: 2 })).toThrow("prompt template not found");
});
