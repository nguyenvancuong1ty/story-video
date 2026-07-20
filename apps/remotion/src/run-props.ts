import type { RemotionScene } from "./types";

export type RomeRunSource = {
  scenes: Array<{ id: string; subtitle: string; imagePath: string; audioPath: string; scene: RemotionScene }>;
};

export type RomeRunScene = {
  from: number;
  durationInFrames: number;
  imagePath: string;
  audioPath: string;
  subtitle: string;
  scene: RemotionScene;
};

export type RomeVideoProps = { scenes: RomeRunScene[] };

export const buildRomeVideoProps = (run: RomeRunSource): RomeVideoProps => ({
  scenes: run.scenes.map((scene, index) => ({
    from: index * 300,
    durationInFrames: 300,
    imagePath: `runs/rome-ja/assets/${scene.id}.png`,
    audioPath: `runs/rome-ja/audio/${scene.id}.mp3`,
    subtitle: scene.subtitle,
    scene: scene.scene
  }))
});
