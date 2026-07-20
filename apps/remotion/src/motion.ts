import { Easing, interpolate } from "remotion";

import type { RenderLayer } from "./types";

export const getLayerTransform = (layer: RenderLayer, frame: number): string => {
  const progress = Math.max(0, Math.min(1, (frame - layer.motion.startFrame) / 30));
  const eased = Easing.out(Easing.cubic)(progress) * layer.motion.intensity;
  const scale = layer.layout.scale * (layer.motion.preset === "primary-entrance" ? interpolate(eased, [0, 1], [0.86, 1]) : 1);
  const y = layer.motion.preset === "primary-entrance" ? interpolate(eased, [0, 1], [55, 0]) : Math.sin(frame / 30) * 8 * layer.motion.intensity;

  return `translate(-50%, -50%) translateY(${y}px) rotate(${layer.layout.rotation}deg) scale(${scale})`;
};
