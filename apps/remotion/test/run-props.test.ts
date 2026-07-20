import { expect, it } from "vitest";

import { buildRomeVideoProps } from "../src/run-props.js";

it("lays out six ten-second media scenes sequentially", () => {
  const props = buildRomeVideoProps({
    scenes: Array.from({ length: 6 }, (_, index) => ({
      id: `scene-0${index + 1}`,
      subtitle: `subtitle-${index + 1}`,
      imagePath: `/tmp/assets/scene-0${index + 1}.png`,
      audioPath: `/tmp/audio/scene-0${index + 1}.mp3`,
      scene: {
        id: `scene-0${index + 1}`,
        camera: { startScale: 1, endScale: 1.08, startX: 0, endX: 0, startY: 0, endY: 0 },
        layers: []
      }
    }))
  });

  expect(props.scenes).toHaveLength(6);
  expect(props.scenes[1]).toMatchObject({
    from: 300,
    durationInFrames: 300,
    imagePath: "runs/rome-ja/assets/scene-02.png",
    audioPath: "runs/rome-ja/audio/scene-02.mp3"
  });
});
