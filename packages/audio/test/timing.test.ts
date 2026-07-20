import { expect, it } from "vitest";

import { updateSceneTimings } from "../src/index.js";

it("uses measured duration to calculate scene frames", () => {
  const updated = updateSceneTimings({ scenes: [{ id: "scene-01" }] }, [{ sceneId: "scene-01", durationMs: 4120 }]);

  expect(updated.scenes[0]).toMatchObject({ durationMs: 4120, durationFrames: 124 });
});
