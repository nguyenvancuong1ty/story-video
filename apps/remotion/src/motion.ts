import { Easing, interpolate } from "remotion";
import type { RenderLayer } from "./types";

const distance = { primary: 78, secondary: 58, tertiary: 38, foreground: 28, background: 0 } as const;
const startScale = { primary: 0.86, secondary: 0.9, tertiary: 0.95, foreground: 0.98, background: 1 } as const;

export const getLayerTransform = (layer: RenderLayer, frame: number): string => {
  const progress = Math.max(0, Math.min(1, (frame - layer.delayFrames) / 30));
  const eased = Easing.out(Easing.cubic)(progress);
  const offset = distance[layer.role] * (1 - eased);
  const x = layer.entrance === "left" ? -offset : layer.entrance === "right" ? offset : 0;
  const y = layer.entrance === "rise" ? offset : 0;
  const scale = interpolate(eased, [0, 1], [startScale[layer.role], 1]);
  const float = progress === 1 && layer.role !== "background" ? Math.sin(frame / 18) * 3 : 0;
  return `translate(-50%, -50%) translate(${x}px, ${y + float}px) scale(${scale})`;
};
