import type { PlannedAsset } from "./types.js";

export class AssetService {
  private readonly assets = new Map<string, PlannedAsset>();

  async plan(input: Omit<PlannedAsset, "status" | "prompt" | "negativePrompt">): Promise<PlannedAsset> {
    if (this.assets.has(input.assetId)) throw new Error(`asset already exists: ${input.assetId}`);

    const asset: PlannedAsset = { ...input, status: "PLANNED" };
    this.assets.set(asset.assetId, asset);
    return { ...asset };
  }

  async preparePrompt(assetId: string, input: { prompt: string; negativePrompt: string }): Promise<PlannedAsset> {
    const asset = this.requireAsset(assetId);
    asset.prompt = input.prompt;
    asset.negativePrompt = input.negativePrompt;
    asset.status = "PROMPT_READY";
    return { ...asset };
  }

  async get(assetId: string): Promise<PlannedAsset> {
    return { ...this.requireAsset(assetId) };
  }

  private requireAsset(assetId: string): PlannedAsset {
    const asset = this.assets.get(assetId);
    if (!asset) throw new Error(`asset not found: ${assetId}`);
    return asset;
  }
}
