import { AbsoluteFill, Audio, staticFile } from "remotion";

import { LayeredScene } from "./scenes/LayeredScene";
import type { VideoProps } from "./types";

export const VideoComposition = ({ scene, audioPath = "silence.wav" }: VideoProps) => (
  <AbsoluteFill>
    <LayeredScene scene={scene} />
    <Audio src={staticFile(audioPath)} />
  </AbsoluteFill>
);
