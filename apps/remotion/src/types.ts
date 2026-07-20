export type RenderLayer = {
  id: string;
  role: string;
  assetType: string;
  assetId?: string;
  zIndex: number;
  layout: { anchorX: number; anchorY: number; widthPercent: number; scale: number; rotation: number };
  motion: { preset: string; startFrame: number; endFrame?: number; intensity: number };
};

export type RemotionScene = {
  id: string;
  camera: { startScale: number; endScale: number; startX: number; endX: number; startY: number; endY: number };
  layers: RenderLayer[];
};

export type FixtureVideoProps = { scene: RemotionScene; audioPath?: string };
export type RunVideoProps = { scenes: Array<{ from: number; durationInFrames: number; imagePath: string; audioPath: string; subtitle: string; scene: RemotionScene }> };
export type VideoProps = FixtureVideoProps | RunVideoProps;
