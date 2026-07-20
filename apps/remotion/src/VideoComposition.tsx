import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";

import { LayeredScene } from "./scenes/LayeredScene";
import type { FixtureVideoProps, VideoProps } from "./types";

const FixtureComposition = ({ scene, audioPath = "silence.wav" }: FixtureVideoProps) => (
  <AbsoluteFill><LayeredScene scene={scene} /><Audio src={staticFile(audioPath)} /></AbsoluteFill>
);

export const VideoComposition = (props: VideoProps) => {
  if (!("scenes" in props)) return <FixtureComposition {...props} />;
  return <AbsoluteFill>{props.scenes.map((item) => (
    <Sequence key={item.scene.id} from={item.from} durationInFrames={item.durationInFrames}>
      <LayeredScene scene={item.scene} imagePath={item.imagePath} />
      <Audio src={staticFile(item.audioPath)} />
      <div style={{ bottom: "8%", color: "white", fontFamily: "sans-serif", fontSize: 52, fontWeight: 700, left: "8%", position: "absolute", right: "8%", textAlign: "center", textShadow: "0 3px 8px black" }}>{item.subtitle}</div>
    </Sequence>
  ))}</AbsoluteFill>;
};
