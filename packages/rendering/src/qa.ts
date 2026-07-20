export const validateComposition = (composition: { layers: Array<{ id: string; role: string; zIndex: number; assetType: string }> }): void => {
  if (!composition.layers.some((layer) => layer.role === "primary")) throw new Error("scene requires a primary layer");

  const indexes = new Set<number>();
  for (const layer of composition.layers) {
    if (indexes.has(layer.zIndex)) throw new Error(`duplicate z-index: ${layer.zIndex}`);
    indexes.add(layer.zIndex);
  }
};
