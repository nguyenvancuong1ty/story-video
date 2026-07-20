export type CompositionLayer = {
  id: string;
  role: string;
  assetId?: string;
  assetType: string;
  zIndex: number;
  layout: Record<string, unknown>;
  motion: Record<string, unknown>;
};

export type CompositionPackage = {
  sceneId: string;
  camera: Record<string, unknown>;
  layers: CompositionLayer[];
  narration: unknown;
  subtitles: unknown[];
};

type ResolvedLayer = { sceneId: string; layerId: string; approvedAssetId: string };
type ApprovedAsset = { id: string; status: string; hasAlpha: boolean };
type InputLayer = { id: string; role: string; assetType: string; layout: { zIndex: number } & Record<string, unknown>; motion: Record<string, unknown> };

export const buildComposition = (input: {
  scene: { id: string; camera: Record<string, unknown>; layers: InputLayer[] };
  resolvedStoryboard: { layers: ResolvedLayer[] };
  approvedAssets: ApprovedAsset[];
  narration: unknown;
  subtitles: unknown[];
}): CompositionPackage => {
  const approvedById = new Map(input.approvedAssets.map((asset) => [asset.id, asset]));
  const bindings = new Map(input.resolvedStoryboard.layers.filter((binding) => binding.sceneId === input.scene.id).map((binding) => [binding.layerId, binding]));

  const layers = input.scene.layers.map((layer) => {
    const requiresAsset = layer.assetType === "generated-image" || layer.assetType === "library-image";
    const binding = bindings.get(layer.id);

    if (requiresAsset && !binding) throw new Error(`missing approved asset binding: ${layer.id}`);
    if (binding && approvedById.get(binding.approvedAssetId)?.status !== "APPROVED") throw new Error(`asset is not approved: ${binding.approvedAssetId}`);

    return {
      id: layer.id,
      role: layer.role,
      assetId: binding?.approvedAssetId,
      assetType: layer.assetType,
      zIndex: layer.layout.zIndex,
      layout: layer.layout,
      motion: layer.motion
    };
  });

  return { sceneId: input.scene.id, camera: input.scene.camera, layers, narration: input.narration, subtitles: input.subtitles };
};
