import type { StyleProfile } from "./profile.js";

export const PAPER_COLLAGE_STYLE_PROFILE: StyleProfile = {
  id: "paper-collage",
  version: 1,
  name: "Paper Collage",
  visualLanguage: "layered paper cut",
  lineTreatment: "paper outline",
  texture: "paper grain",
  lighting: "soft cinematic",
  palette: ["#111111", "#F3E7D3", "#C84A32"],
  characterProportions: "editorial illustration",
  imagePromptPrefix: "paper collage documentary illustration",
  imagePromptSuffix: "clean separated layers",
  negativePrompt: ["text", "watermark", "photorealism"],
  motionPresetSet: "paper-v1",
  typographyPreset: "documentary-v1",
  transitionPresetSet: "paper-v1"
};
