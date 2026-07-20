import { afterEach, expect, it, vi } from "vitest";

import { getProjectWorkflow } from "../lib/api.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it("loads workflow state from the API", async () => {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ key: "RESEARCH", status: "running" }]), { status: 200 }));

  await expect(getProjectWorkflow("prj_1")).resolves.toEqual([{ key: "RESEARCH", status: "running" }]);
  expect(globalThis.fetch).toHaveBeenCalledWith("http://localhost:3001/projects/prj_1/workflow");
});
