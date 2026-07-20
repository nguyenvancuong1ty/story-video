export * from "./cache.js";
export * from "./library.js";
export * from "./processing.js";
export * from "./provider.js";
export * from "./qa.js";
export * from "./service.js";
export * from "./types.js";

type StoryboardLayer = {
  id: string;
  assetType: string;
  generation?: { transparentBackground: boolean };
};

type StoryboardInput = { scenes: Array<{ id: string; layers: StoryboardLayer[] }> };

export const planAssetsFromStoryboard = (storyboard: StoryboardInput): import("./types.js").AssetJob[] =>
  storyboard.scenes.flatMap((scene) =>
    scene.layers.flatMap((layer) => {
      if (layer.assetType !== "generated-image" && layer.assetType !== "library-image") return [];
      if (layer.assetType === "generated-image" && !layer.generation) throw new Error(`generated layer missing generation: ${layer.id}`);

      return [
        {
          assetId: `asset-${layer.id}`,
          sceneId: scene.id,
          layerId: layer.id,
          assetType: layer.assetType,
          alphaRequired: layer.assetType === "generated-image" ? layer.generation!.transparentBackground : false
        }
      ];
    })
  );
