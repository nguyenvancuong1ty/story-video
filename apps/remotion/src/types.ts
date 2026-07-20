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

export type VideoProps = { scene: RemotionScene; audioPath?: string };
