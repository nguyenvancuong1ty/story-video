import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";

import { getLayerTransform } from "../motion";
import type { RemotionScene } from "../types";

export const LayeredScene = ({ scene, imagePath }: { scene: RemotionScene; imagePath?: string }) => {
  const frame = useCurrentFrame();
  const cameraProgress = Math.min(1, frame / 90);
  const cameraScale = scene.camera.startScale + (scene.camera.endScale - scene.camera.startScale) * cameraProgress;
  const cameraX = scene.camera.startX + (scene.camera.endX - scene.camera.startX) * cameraProgress;
  const cameraY = scene.camera.startY + (scene.camera.endY - scene.camera.startY) * cameraProgress;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#e9ddc4" }}>
      {imagePath ? <Img src={staticFile(imagePath)} style={{ height: "100%", objectFit: "cover", width: "100%" }} /> : null}
      <AbsoluteFill style={{ transform: `translate(${cameraX}px, ${cameraY}px) scale(${cameraScale})`, transformOrigin: "center" }}>
        {scene.layers.map((layer) => (
          <div key={layer.id} style={layer.role === "background" ? {
            position: "absolute", inset: 0, zIndex: layer.zIndex, background: "#856b52"
          } : {
            position: "absolute",
            left: `${layer.layout.anchorX * 100}%`,
            top: `${layer.layout.anchorY * 100}%`,
            width: `${layer.layout.widthPercent}%`,
            aspectRatio: "1 / 1",
            zIndex: layer.zIndex,
            transform: getLayerTransform(layer, frame),
            transformOrigin: "center",
            border: layer.assetType === "particle" ? "none" : "7px solid #1c1b18",
            background: layer.assetType === "particle" ? "transparent" : "#c94a32",
            boxShadow: layer.assetType === "particle" ? "none" : "12px 14px 0 rgba(28,27,24,0.32)"
          }}>
            {layer.assetType === "particle" ? <svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="20" cy="30" r="4" fill="#1c1b18" /><circle cx="60" cy="48" r="3" fill="#1c1b18" /><circle cx="75" cy="18" r="5" fill="#1c1b18" /></svg> : null}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
