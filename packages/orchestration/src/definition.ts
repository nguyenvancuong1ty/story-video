export const WORKFLOW_STAGES = [
  { key: "INPUT", requires: [] },
  { key: "RESEARCH", requires: ["INPUT"] },
  { key: "FACT_CHECK", requires: ["RESEARCH"] },
  { key: "EDITORIAL_ANGLE", requires: ["FACT_CHECK"] },
  { key: "LOCALIZATION", requires: ["EDITORIAL_ANGLE"] },
  { key: "SCRIPT", requires: ["LOCALIZATION"] },
  { key: "STORYBOARD", requires: ["SCRIPT"] },
  { key: "ASSET_PLANNING", requires: ["STORYBOARD"] },
  { key: "IMAGE_GENERATION", requires: ["ASSET_PLANNING"] },
  { key: "TTS", requires: ["SCRIPT"] },
  { key: "TIMING_SUBTITLE", requires: ["TTS"] },
  { key: "COMPOSITION", requires: ["IMAGE_GENERATION", "TIMING_SUBTITLE"] },
  { key: "RENDER", requires: ["COMPOSITION"] },
  { key: "QA", requires: ["RENDER"] },
  { key: "PUBLISHING_PACKAGE", requires: ["QA"] }
] as const;

export type WorkflowStageKey = (typeof WORKFLOW_STAGES)[number]["key"];
export type StageStatus = "pending" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled";

export const OPTIONAL_GATE_STAGES = new Set<WorkflowStageKey>(["SCRIPT", "IMAGE_GENERATION", "RENDER"]);
