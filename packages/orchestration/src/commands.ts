import { OPTIONAL_GATE_STAGES, type WorkflowStageKey } from "./definition.js";

export type StageCommand = "run" | "cancel" | "retry" | "approve" | "reject" | "rerun_from_here";

export const assertCommandAllowed = (stage: WorkflowStageKey, command: StageCommand, gateEnabled: boolean): void => {
  if ((command === "approve" || command === "reject") && (!OPTIONAL_GATE_STAGES.has(stage) || !gateEnabled)) {
    throw new Error(`approval is not available for ${stage}`);
  }
};
