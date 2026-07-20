import { expect, it } from "vitest";

import { sumProjectCost } from "../src/index.js";

it("sums immutable project cost records", () => {
  expect(sumProjectCost([{ amountUsd: 0.2 }, { amountUsd: 0.18 }])).toBe(0.38);
});
