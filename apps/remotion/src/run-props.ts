import type { RemotionShot, RenderLayer, RunVideoProps } from "./types";

export type RomeRunSource = { beats: Array<{ id: string; subtitle: string; audioPath: string; shots: Array<{ id: string; durationInFrames: number; camera: RemotionShot["camera"]; layers: Array<Omit<RenderLayer, "assetPath"> & { assetPath: string }> }> }> };

export const buildRomeVideoProps = (run: RomeRunSource): RunVideoProps => ({
  beats: run.beats.map((beat, beatIndex) => ({
    id: beat.id, from: beatIndex * 360, durationInFrames: 360, subtitle: beat.subtitle, audioPath: `runs/rome-vi/audio/${beat.id}.mp3`,
    shots: beat.shots.map((shot, shotIndex) => ({ ...shot, from: shotIndex * 180, durationInFrames: 180, layers: shot.layers.map((layer) => ({ ...layer, assetPath: `runs/rome-vi/assets/${shot.id}/${layer.assetPath.split("/").at(-1)}` })) }))
  }))
});
