import { AbsoluteFill, Audio, Sequence, Video, interpolate, staticFile, useCurrentFrame } from "remotion";

export type SecondActRenderBeat = {
  id: string;
  from: number;
  durationInFrames: number;
  audioPath: string;
  videoPath: string;
  subtitle: string;
};

export type SecondActRenderProps = {
  title: string;
  beats: SecondActRenderBeat[];
  musicPath?: string;
};

const subtitleStyle = {
  position: "absolute" as const,
  left: "8%",
  right: "8%",
  bottom: "7%",
  color: "white",
  fontFamily: "Arial, sans-serif",
  fontWeight: 700,
  fontSize: 42,
  lineHeight: 1.2,
  textAlign: "center" as const,
  textShadow: "0 3px 12px rgba(0,0,0,.9)",
  padding: "16px 22px",
  borderRadius: 14,
  background: "rgba(0,0,0,.34)"
};

const BeatVisual = ({ beat }: { beat: SecondActRenderBeat }) => {
  const frame = useCurrentFrame();
  const fade = Math.min(15, Math.max(1, Math.floor(beat.durationInFrames / 8)));
  const opacity = interpolate(
    frame,
    [0, fade, Math.max(fade + 1, beat.durationInFrames - fade), beat.durationInFrames - 1],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "black", opacity }}>
      <Video
        src={staticFile(beat.videoPath)}
        muted
        loop
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.12) 55%, rgba(0,0,0,.5))" }} />
      <div style={subtitleStyle}>{beat.subtitle}</div>
    </AbsoluteFill>
  );
};

export const SecondActComposition = ({ title, beats, musicPath }: SecondActRenderProps) => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    {musicPath ? <Audio src={staticFile(musicPath)} volume={0.075} loop /> : null}
    {beats.map((beat) => (
      <Sequence key={beat.id} from={beat.from} durationInFrames={beat.durationInFrames}>
        <BeatVisual beat={beat} />
        <Audio src={staticFile(beat.audioPath)} />
      </Sequence>
    ))}
    <div style={{ position: "absolute", top: 30, right: 34, color: "rgba(255,255,255,.52)", fontSize: 18, fontFamily: "Arial, sans-serif", letterSpacing: 1.2 }}>
      SECOND ACT STORIES
    </div>
    <div style={{ position: "absolute", top: 30, left: 34, color: "rgba(255,255,255,.42)", fontSize: 16, fontFamily: "Arial, sans-serif", maxWidth: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {title}
    </div>
  </AbsoluteFill>
);
