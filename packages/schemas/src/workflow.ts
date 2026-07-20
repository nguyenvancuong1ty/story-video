import { z } from "zod";

export const WorkflowStageSchema = z.enum([
  "INPUT",
  "RESEARCH",
  "FACT_CHECK",
  "EDITORIAL_ANGLE",
  "LOCALIZATION",
  "SCRIPT",
  "STORYBOARD",
  "ASSET_PLANNING",
  "IMAGE_GENERATION",
  "TTS",
  "TIMING_SUBTITLE",
  "COMPOSITION",
  "RENDER",
  "QA",
  "PUBLISHING_PACKAGE"
]);

export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;
