import { expect, it } from "vitest";

import { createRomeJapanesePilot, runPilot } from "../../../packages/test-kit/src/pilots/index.js";

it("produces a source-traceable publishing package with a cached asset", async () => {
  const result = await runPilot(createRomeJapanesePilot());

  expect(result.finalArtifact.kind).toBe("PublishingPackage");
  expect(result.traceFromRenderToSources.length).toBeGreaterThan(0);
  expect(result.artifacts).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "CharacterRegistry" }),
    expect.objectContaining({ metadata: expect.objectContaining({ promptTemplateId: expect.any(String), promptTemplateVersion: expect.any(Number) }) }),
    expect.objectContaining({ metadata: expect.objectContaining({ styleProfileId: "paper-collage", styleProfileVersion: 1 }) })
  ]));
  expect(result.telemetry.assetCacheHits).toBeGreaterThan(0);
});
