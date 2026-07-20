import { expect, it } from "vitest";

import { createMemoryArtifactStore } from "../src/fakes.js";

it("reads stored bytes", async () => {
  const store = createMemoryArtifactStore();

  await store.put("a.txt", Buffer.from("a"), "text/plain");

  await expect(store.get("a.txt")).resolves.toEqual(Buffer.from("a"));
});
