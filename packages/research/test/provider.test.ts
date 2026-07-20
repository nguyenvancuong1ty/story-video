import { expect, it } from "vitest";

import { FakeResearchProvider } from "../src/index.js";

it("returns traceable research sources from the provider boundary", async () => {
  const provider = new FakeResearchProvider([
    {
      id: "src_1",
      providerSourceId: "provider_1",
      title: "The Fall of Rome",
      url: "https://example.com/rome",
      excerpt: "source excerpt",
      retrievedAt: "2026-07-19T00:00:00.000Z"
    }
  ]);

  await expect(provider.search({ query: "fall of Rome", language: "en", limit: 3 })).resolves.toMatchObject([
    { id: "src_1", url: "https://example.com/rome" }
  ]);
});
