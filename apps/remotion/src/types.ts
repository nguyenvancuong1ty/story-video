export type RenderLayer = {
  id: string;
  role: "background" | "tertiary" | "secondary" | "primary" | "foreground";
  assetPath: string;
  x: number; y: number; widthPercent: number; zIndex: number; delayFrames: number;
  entrance: "none" | "rise" | "left" | "right";
};

export type RemotionShot = {
  id: string; durationInFrames: number;
  camera: { startScale: number; endScale: number; startX: number; endX: number; startY: number; endY: number };
  layers: RenderLayer[];
};

export type FixtureVideoProps = { scene: RemotionShot; audioPath?: string };
export type RunVideoProps = { beats: Array<{ id: string; from: number; durationInFrames: number; audioPath: string; subtitle: string; shots: Array<RemotionShot & { from: number }> }> };
export type VideoProps = FixtureVideoProps | RunVideoProps;
