import { createHash } from "node:crypto";

import type { AssetGenerationFingerprint } from "./types.js";

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
};

export const computeAssetCacheKey = (fingerprint: AssetGenerationFingerprint): string =>
  createHash("sha256").update(JSON.stringify(stableValue(fingerprint))).digest("hex");

export type CachedAsset = { assetId: string; status: "APPROVED"; usageRightsCompatible: boolean };

export class AssetCache {
  private readonly entries = new Map<string, CachedAsset>();

  put(key: string, asset: CachedAsset): void {
    this.entries.set(key, { ...asset });
  }

  get(key: string): CachedAsset | undefined {
    const asset = this.entries.get(key);
    return asset?.usageRightsCompatible ? { ...asset } : undefined;
  }
}
