import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { LayeredScene } from "./scenes/LayeredScene";
import type { FixtureVideoProps, VideoProps } from "./types";

const FixtureComposition = ({ scene, audioPath = "silence.wav" }: FixtureVideoProps) => <AbsoluteFill><LayeredScene scene={scene} /><Audio src={staticFile(audioPath)} /></AbsoluteFill>;
const subtitleStyle = { position: "absolute" as const, bottom: "7%", left: "7%", right: "7%", color: "white", fontFamily: "sans-serif", fontSize: 46, fontWeight: 700, lineHeight: 1.28, textAlign: "center" as const, textShadow: "0 3px 8px black", padding: "18px 24px", background: "linear-gradient(transparent, rgba(0,0,0,.6))" };

export const VideoComposition = (props: VideoProps) => {
  if (!("beats" in props)) return <FixtureComposition {...props} />;
  return <AbsoluteFill>{props.beats.map((beat) => <Sequence key={beat.id} from={beat.from} durationInFrames={beat.durationInFrames}>
    <Audio src={staticFile(beat.audioPath)} />
    {beat.shots.map((shot) => <Sequence key={shot.id} from={shot.from} durationInFrames={shot.durationInFrames}><LayeredScene scene={shot} /></Sequence>)}
    <div style={subtitleStyle}>{beat.subtitle}</div>
  </Sequence>)}</AbsoluteFill>;
};
