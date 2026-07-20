const STAGES = ["INPUT", "RESEARCH", "FACT_CHECK", "EDITORIAL_ANGLE", "LOCALIZATION", "SCRIPT", "STORYBOARD", "ASSET_PLANNING", "IMAGE_GENERATION", "TTS", "TIMING_SUBTITLE", "COMPOSITION", "RENDER", "QA", "PUBLISHING_PACKAGE"] as const;

export type WorkflowStage = (typeof STAGES)[number];
export type WorkflowStatus = "pending" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled";
export type WorkflowStageState = { key: WorkflowStage; status: WorkflowStatus; progress?: { completed: number; total: number }; costUsd: number; warning?: string; log: string };
export type StageCommand = "run" | "cancel" | "retry" | "approve" | "reject" | "rerun_from_here";

export class ProjectService {
  private readonly projects = new Map<string, WorkflowStageState[]>();

  private getMutableWorkflow(projectId: string): WorkflowStageState[] {
    if (!this.projects.has(projectId)) {
      this.projects.set(projectId, STAGES.map((key) => ({ key, status: "pending", costUsd: 0, log: "Awaiting stage command" })));
    }
    return this.projects.get(projectId)!;
  }

  getWorkflow(projectId: string): WorkflowStageState[] {
    return this.getMutableWorkflow(projectId).map((stage) => ({ ...stage }));
  }

  command(projectId: string, stageKey: string, command: StageCommand): WorkflowStageState {
    const stages = this.getMutableWorkflow(projectId);
    const stage = stages.find((item) => item.key === stageKey);
    if (!stage) throw new Error(`unknown stage: ${stageKey}`);
    if ((command === "approve" || command === "reject") && !["SCRIPT", "IMAGE_GENERATION", "RENDER"].includes(stage.key)) throw new Error(`approval unavailable for ${stage.key}`);

    const statusByCommand: Record<StageCommand, WorkflowStatus> = { run: "running", cancel: "cancelled", retry: "running", approve: "completed", reject: "failed", rerun_from_here: "running" };
    stage.status = statusByCommand[command];
    stage.log = `${command} requested`;
    return { ...stage };
  }
}
