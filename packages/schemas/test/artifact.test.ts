import { expect, it } from "vitest";

import { ArtifactSchema, ProjectConfigSchema } from "../src/index.js";

it("requires a complete immutable artifact envelope", () => {
  expect(() => ArtifactSchema.parse({ kind: "script" })).toThrow();
  expect(
    ArtifactSchema.parse({
      id: "art_1",
      projectId: "prj_1",
      kind: "LocalizedScript",
      version: 2,
      status: "ready",
      inputArtifactIds: ["art_0"],
      payload: {},
      createdAt: "2026-07-19T00:00:00.000Z",
      createdBy: "worker"
    }).version
  ).toBe(2);
});

it("requires an immutable style profile reference in project configuration", () => {
  expect(() => ProjectConfigSchema.parse({ topic: "Rome" })).toThrow();
  expect(
    ProjectConfigSchema.parse({
      contentDomain: "History",
      topic: "Fall of Rome",
      storyFormat: "documentary",
      audience: "general",
      presentation: "paper-collage",
      truthPolicy: "factual",
      styleProfileRef: { id: "paper-collage", version: 1 }
    }).styleProfileRef
  ).toEqual({ id: "paper-collage", version: 1 });
});
