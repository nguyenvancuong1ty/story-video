import type { StageStatus, WorkflowStageKey } from "./definition.js";

export type WorkflowEvent = {
  runId: string;
  stage: WorkflowStageKey;
  status: StageStatus;
  at: string;
};
