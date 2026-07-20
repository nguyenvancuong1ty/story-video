import { expect, it } from "vitest";

import { WORKFLOW_STAGES, WorkflowEngine } from "../src/index.js";

it("defines the fixed 15-stage workflow", () => {
  expect(WORKFLOW_STAGES.map((item) => item.key)).toEqual([
    "INPUT",
    "RESEARCH",
    "FACT_CHECK",
    "EDITORIAL_ANGLE",
    "LOCALIZATION",
    "SCRIPT",
    "STORYBOARD",
    "ASSET_PLANNING",
    "IMAGE_GENERATION",
    "TTS",
    "TIMING_SUBTITLE",
    "COMPOSITION",
    "RENDER",
    "QA",
    "PUBLISHING_PACKAGE"
  ]);
});

it("retries a failed child without changing completed siblings", async () => {
  const engine = new WorkflowEngine("run_1");

  await engine.enqueueChild({ stage: "TTS", childKey: "scene-01" });
  await engine.enqueueChild({ stage: "TTS", childKey: "scene-02" });
  await engine.completeChild("scene-02");
  await engine.failChild("scene-01", "PROVIDER_TIMEOUT");
  await engine.retryChild("scene-01");

  await expect(engine.getCompletedChildren("TTS")).resolves.toEqual(["scene-02"]);
  await expect(engine.getChild("scene-01")).resolves.toMatchObject({ status: "pending", retryCount: 1 });
});

it("does not retry permanent child failures", async () => {
  const engine = new WorkflowEngine("run_1");

  await engine.enqueueChild({ stage: "TTS", childKey: "scene-01" });
  await engine.failChild("scene-01", "INVALID_REQUEST");

  await expect(engine.retryChild("scene-01")).rejects.toThrow("not retryable");
});
