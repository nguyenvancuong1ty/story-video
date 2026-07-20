import { expect, it } from "vitest";

import { createChildJobId } from "../src/queues.js";

it("uses stable child job identifiers for retry-safe queue work", () => {
  expect(createChildJobId("execution_1", "scene-01")).toBe("execution_1:scene-01");
});
