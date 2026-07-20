import { expect, it } from "vitest";

import { ImageBudget } from "../src/credentialed/image-budget.js";

it("allows a cache hit after reaching the ten-image limit", () => {
  const budget = new ImageBudget(10);
  for (let index = 0; index < 10; index += 1) {
    expect(budget.reserve(`key-${index}`)).toBe("reserved");
    budget.commit(`key-${index}`, `asset-${index}`);
  }

  expect(budget.reserve("key-0")).toBe("cache-hit");
  expect(budget.assetId("key-0")).toBe("asset-0");
  expect(() => budget.reserve("key-10")).toThrow("image budget exhausted: maximum 10 generated images per project");
});
