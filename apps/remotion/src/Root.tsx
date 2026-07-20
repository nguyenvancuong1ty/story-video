import { Composition } from "remotion";
import { VideoComposition } from "./VideoComposition";
import { buildRomeVideoProps } from "./run-props";
import type { RemotionShot, VideoProps } from "./types";

const layers = ["background", "tertiary", "secondary", "primary", "foreground"] as const;
const fixtureShot = (id: string): RemotionShot => ({ id, durationInFrames: 180, camera: { startScale: 1, endScale: 1.04, startX: 0, endX: -8, startY: 0, endY: 4 }, layers: layers.map((role, index) => ({ id: `${id}-${role}`, role, assetPath: `runs/rome-vi/assets/${id}/${role}.png`, x: 50, y: role === "foreground" ? 80 : 52, widthPercent: role === "background" ? 100 : role === "primary" ? 54 : 32, zIndex: index, delayFrames: index * 8, entrance: role === "background" ? "none" : role === "secondary" ? "left" : role === "tertiary" ? "right" : "rise" })) });
const fixture: VideoProps = { scene: fixtureShot("beat-01-wide") };
const runFixture = buildRomeVideoProps({ beats: Array.from({ length: 5 }, (_, index) => ({ id: `beat-0${index + 1}`, subtitle: "Câu chuyện La Mã", audioPath: "", shots: [fixtureShot(`beat-0${index + 1}-wide`), fixtureShot(`beat-0${index + 1}-detail`)] })) });

export const RemotionRoot = () => <>
  <Composition id="KnowledgeStoryFixture" component={VideoComposition} durationInFrames={180} fps={30} width={1080} height={1920} defaultProps={fixture} />
  <Composition id="KnowledgeStoryRun" component={VideoComposition} durationInFrames={1800} fps={30} width={1080} height={1920} defaultProps={runFixture} />
</>;
