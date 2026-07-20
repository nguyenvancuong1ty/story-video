import { expect, it } from "vitest";

import { createMemoryArtifactRepository } from "../src/index.js";

it("traces all direct and transitive artifact inputs", async () => {
  const repository = createMemoryArtifactRepository();
  const fact = await repository.createVersion("prj_1", "FactPackage", [], { facts: [] });
  const script = await repository.createVersion("prj_1", "LocalizedScript", [fact.id], { scenes: [] });
  const storyboard = await repository.createVersion("prj_1", "DirectorStoryboard", [script.id], { scenes: [] });

  await expect(repository.traceInputs(storyboard.id)).resolves.toEqual([script.id, fact.id]);
});

it("increments versions within a project and kind", async () => {
  const repository = createMemoryArtifactRepository();

  expect((await repository.createVersion("prj_1", "FactPackage", [], {})).version).toBe(1);
  expect((await repository.createVersion("prj_1", "FactPackage", [], {})).version).toBe(2);
});
