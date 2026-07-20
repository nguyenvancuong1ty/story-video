import { Composition } from "remotion";

import { VideoComposition } from "./VideoComposition";
import type { VideoProps } from "./types";

const fixture: VideoProps = {
  scene: {
    id: "fixture",
    camera: { startScale: 1, endScale: 1.08, startX: 0, endX: -32, startY: 0, endY: 14 },
    layers: [
      { id: "background", role: "background", assetType: "generated-image", zIndex: 0, layout: { anchorX: 0.5, anchorY: 0.5, widthPercent: 120, scale: 1, rotation: 0 }, motion: { preset: "background-parallax", startFrame: 0, intensity: 0.2 } },
      { id: "primary", role: "primary", assetType: "generated-image", zIndex: 5, layout: { anchorX: 0.5, anchorY: 0.55, widthPercent: 48, scale: 1, rotation: -2 }, motion: { preset: "primary-entrance", startFrame: 6, intensity: 0.7 } },
      { id: "dust", role: "effect", assetType: "particle", zIndex: 7, layout: { anchorX: 0.5, anchorY: 0.4, widthPercent: 100, scale: 1, rotation: 0 }, motion: { preset: "slow-drift", startFrame: 0, intensity: 0.3 } }
    ]
  }
};

export const RemotionRoot = () => <Composition id="KnowledgeStoryFixture" component={VideoComposition} durationInFrames={90} fps={30} width={1080} height={1920} defaultProps={fixture} />;
