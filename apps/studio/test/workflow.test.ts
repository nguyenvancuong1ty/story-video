import { expect, it } from "vitest";

import { toFlowNodes } from "../lib/workflow.js";

it("projects all 15 workflow stages into graph nodes", () => {
  const workflow = Array.from({ length: 15 }, (_, index) => ({ key: `STAGE_${index}`, status: "pending", progress: index === 8 ? { completed: 18, total: 24 } : undefined }));
  workflow[8] = { key: "IMAGE_GENERATION", status: "running", progress: { completed: 18, total: 24 } };

  expect(toFlowNodes(workflow)).toHaveLength(15);
  expect(toFlowNodes(workflow).find((node) => node.id === "IMAGE_GENERATION")?.data.progress).toEqual({ completed: 18, total: 24 });
});
