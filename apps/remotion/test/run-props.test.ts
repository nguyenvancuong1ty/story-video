import { expect, it } from "vitest";
import { buildRomeVideoProps } from "../src/run-props.js";

it("maps a beat to one audio sequence and two visual sequences", () => {
  const props = buildRomeVideoProps({ beats: [{ id: "beat-01", subtitle: "La Mã", audioPath: "/tmp/audio.mp3", shots: ["wide", "detail"].map((view) => ({ id: `beat-01-${view}`, durationInFrames: 180, camera: { startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0 }, layers: [{ id: view, role: "primary" as const, assetPath: `/tmp/${view}.png`, x: 50, y: 50, widthPercent: 50, zIndex: 5, delayFrames: 4, entrance: "rise" as const }] })) }] });
  expect(props.beats[0]).toMatchObject({ from: 0, durationInFrames: 360, audioPath: "runs/rome-vi/audio/beat-01.mp3", shots: [{ from: 0 }, { from: 180 }] });
});
