import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { getLayerTransform } from "../motion";
import type { RemotionShot } from "../types";

export const LayeredScene = ({ scene }: { scene: RemotionShot }) => {
  const frame = useCurrentFrame();
  const progress = Math.min(1, frame / scene.durationInFrames);
  const cameraScale = scene.camera.startScale + (scene.camera.endScale - scene.camera.startScale) * progress;
  const cameraX = scene.camera.startX + (scene.camera.endX - scene.camera.startX) * progress;
  const cameraY = scene.camera.startY + (scene.camera.endY - scene.camera.startY) * progress;
  const layers = [...scene.layers].sort((left, right) => left.zIndex - right.zIndex);
  return <AbsoluteFill style={{ overflow: "hidden", background: "#e9ddc4" }}>
    {layers.map((layer) => <Img key={layer.id} src={staticFile(layer.assetPath)} style={{
      position: "absolute", left: `${layer.x}%`, top: `${layer.y}%`, width: `${layer.widthPercent}%`, zIndex: layer.zIndex,
      transform: layer.role === "background" ? `translate(-50%, -50%) translate(${cameraX}px, ${cameraY}px) scale(${cameraScale})` : getLayerTransform(layer, frame),
      transformOrigin: "center", objectFit: layer.role === "background" ? "cover" : "contain", height: layer.role === "background" ? "100%" : "auto",
      filter: layer.role === "background" ? undefined : "drop-shadow(4px 0 #f5eedc) drop-shadow(-4px 0 #f5eedc) drop-shadow(0 4px #f5eedc) drop-shadow(0 18px 9px rgba(20,15,12,.32))"
    }} />)}
  </AbsoluteFill>;
};
