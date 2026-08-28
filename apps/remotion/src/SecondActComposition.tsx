import {
  AbsoluteFill,
  Audio,
  Sequence,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame
} from "remotion";

export type SecondActVisualTone = "cool" | "neutral" | "warm" | "hopeful";

export type SecondActRenderShot = {
  id: string;
  from: number;
  durationInFrames: number;
  overlapInFrames: number;
  videoPath: string;
  sourceStartInFrames: number;
  playbackRate: number;
  motion: {
    startScale: number;
    endScale: number;
    startX: number;
    endX: number;
    startY: number;
    endY: number;
  };
  overlayText?: string;
};

export type SecondActRenderBeat = {
  id: string;
  from: number;
  durationInFrames: number;
  audioPath: string;
  subtitle: string;
  visualTone: SecondActVisualTone;
  chapterLabel?: string;
  ambiencePath?: string;
  shots: SecondActRenderShot[];
};

export type SecondActRenderProps = {
  title: string;
  beats: SecondActRenderBeat[];
  musicPath?: string;
};

const subtitleStyle = {
  position: "absolute" as const,
  left: "12%",
  right: "12%",
  bottom: "6.5%",
  color: "white",
  fontFamily: "Arial, sans-serif",
  fontWeight: 700,
  fontSize: 40,
  lineHeight: 1.2,
  textAlign: "center" as const,
  textShadow: "0 3px 14px rgba(0,0,0,.95)",
  padding: "15px 22px",
  borderRadius: 12,
  background: "linear-gradient(90deg, transparent, rgba(0,0,0,.48) 18%, rgba(0,0,0,.48) 82%, transparent)"
};

const toneStyle: Record<SecondActVisualTone, { filter: string; wash: string }> = {
  cool: {
    filter: "saturate(.78) contrast(1.08) brightness(.9)",
    wash: "rgba(26,54,78,.13)"
  },
  neutral: {
    filter: "saturate(.88) contrast(1.06) brightness(.92)",
    wash: "rgba(22,24,28,.08)"
  },
  warm: {
    filter: "saturate(.9) contrast(1.05) brightness(.94) sepia(.07)",
    wash: "rgba(92,54,26,.1)"
  },
  hopeful: {
    filter: "saturate(.98) contrast(1.03) brightness(.98) sepia(.04)",
    wash: "rgba(118,92,38,.07)"
  }
};

const ShotVisual = ({
  shot,
  tone,
  fadeOutFrames
}: {
  shot: SecondActRenderShot;
  tone: SecondActVisualTone;
  fadeOutFrames: number;
}) => {
  const frame = useCurrentFrame();
  const lastFrame = Math.max(1, shot.durationInFrames - 1);
  const fadeIn = Math.min(shot.overlapInFrames, Math.floor(lastFrame / 3));
  const fadeOut = Math.min(fadeOutFrames, Math.floor(lastFrame / 3));
  const fadeInOpacity = fadeIn > 0
    ? interpolate(frame, [0, fadeIn], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const fadeOutOpacity = fadeOut > 0
    ? interpolate(frame, [lastFrame - fadeOut, lastFrame], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);
  const scale = interpolate(frame, [0, lastFrame], [shot.motion.startScale, shot.motion.endScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const x = interpolate(frame, [0, lastFrame], [shot.motion.startX, shot.motion.endX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const y = interpolate(frame, [0, lastFrame], [shot.motion.startY, shot.motion.endY], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const textOpacity = shot.overlayText
    ? interpolate(frame, [12, 28, Math.max(29, lastFrame - 20), lastFrame], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    })
    : 0;
  const grade = toneStyle[tone];

  return (
    <AbsoluteFill style={{ backgroundColor: "black", opacity }}>
      <Video
        src={staticFile(shot.videoPath)}
        muted
        loop
        startFrom={shot.sourceStartInFrames}
        playbackRate={shot.playbackRate}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: grade.filter,
          transform: `translate(${x}%, ${y}%) scale(${scale})`
        }}
      />
      <div style={{ position: "absolute", inset: 0, backgroundColor: grade.wash }} />
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,.13), rgba(0,0,0,.03) 48%, rgba(0,0,0,.52))"
      }} />
      {shot.overlayText ? (
        <div style={{
          position: "absolute",
          left: 78,
          top: 150,
          maxWidth: 850,
          color: "rgba(255,255,255,.94)",
          fontFamily: "Georgia, serif",
          fontSize: 48,
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: -.6,
          textShadow: "0 3px 16px rgba(0,0,0,.86)",
          opacity: textOpacity
        }}>
          “{shot.overlayText}”
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const ChapterCard = ({ label, durationInFrames }: { label: string; durationInFrames: number }) => {
  const frame = useCurrentFrame();
  const visibleUntil = Math.min(durationInFrames - 1, 84);
  const opacity = interpolate(
    frame,
    [0, 12, Math.max(13, visibleUntil - 18), visibleUntil],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div style={{
      position: "absolute",
      top: 82,
      left: 72,
      color: "white",
      fontFamily: "Arial, sans-serif",
      opacity,
      textShadow: "0 3px 14px rgba(0,0,0,.85)"
    }}>
      <div style={{ fontSize: 17, letterSpacing: 4.5, fontWeight: 700, color: "rgba(255,255,255,.68)" }}>
        SECOND ACT
      </div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 48, marginTop: 9, maxWidth: 980, lineHeight: 1.05 }}>
        {label}
      </div>
    </div>
  );
};

const BeatVisual = ({ beat }: { beat: SecondActRenderBeat }) => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    {beat.shots.map((shot, index) => (
      <Sequence key={shot.id} from={shot.from} durationInFrames={shot.durationInFrames}>
        <ShotVisual
          shot={shot}
          tone={beat.visualTone}
          fadeOutFrames={beat.shots[index + 1]?.overlapInFrames ?? 0}
        />
      </Sequence>
    ))}
    {beat.chapterLabel ? <ChapterCard label={beat.chapterLabel} durationInFrames={beat.durationInFrames} /> : null}
    <div style={subtitleStyle}>{beat.subtitle}</div>
  </AbsoluteFill>
);

export const SecondActComposition = ({ title, beats, musicPath }: SecondActRenderProps) => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    {musicPath ? <Audio src={staticFile(musicPath)} volume={0.055} loop /> : null}
    {beats.map((beat) => (
      <Sequence key={beat.id} from={beat.from} durationInFrames={beat.durationInFrames}>
        <BeatVisual beat={beat} />
        <Audio src={staticFile(beat.audioPath)} />
        {beat.ambiencePath ? <Audio src={staticFile(beat.ambiencePath)} volume={0.045} loop /> : null}
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
