import { expect, it } from "vitest";

import { AssetCache } from "../src/index.js";

it("reuses only approved assets with an exact fingerprint", () => {
  const cache = new AssetCache();
  cache.put("key-1", { assetId: "asset_1", status: "APPROVED", usageRightsCompatible: true });

  expect(cache.get("key-1")).toMatchObject({ assetId: "asset_1" });
  expect(cache.get("key-2")).toBeUndefined();
});
