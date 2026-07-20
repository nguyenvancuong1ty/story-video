import { WORKFLOW_STAGES, type StageStatus, type WorkflowStageKey } from "./definition.js";

export type ChildFailureCode = "PROVIDER_TIMEOUT" | "RATE_LIMIT" | "TRANSIENT_STORAGE" | "INVALID_REQUEST";
export type ChildStatus = "pending" | "running" | "completed" | "failed";
export type WorkflowChild = {
  stage: WorkflowStageKey;
  childKey: string;
  status: ChildStatus;
  retryCount: number;
  failureCode?: ChildFailureCode;
};

export type StageContext = { runId: string; stage: WorkflowStageKey };
export type StageResult = { outputArtifactIds: string[] };
export type StageHandler = (context: StageContext) => Promise<StageResult>;

const RETRYABLE_FAILURES = new Set<ChildFailureCode>(["PROVIDER_TIMEOUT", "RATE_LIMIT", "TRANSIENT_STORAGE"]);

export class WorkflowEngine {
  private readonly children = new Map<string, WorkflowChild>();
  private readonly stages = new Map<WorkflowStageKey, StageStatus>(WORKFLOW_STAGES.map((stage) => [stage.key, "pending"]));

  constructor(readonly runId: string) {}

  async runStage(stage: WorkflowStageKey): Promise<StageStatus> {
    this.stages.set(stage, "running");
    return "running";
  }

  async getStageStatus(stage: WorkflowStageKey): Promise<StageStatus> {
    return this.stages.get(stage) ?? "pending";
  }

  async enqueueChild(input: Pick<WorkflowChild, "stage" | "childKey">): Promise<WorkflowChild> {
    if (this.children.has(input.childKey)) {
      throw new Error(`child already exists: ${input.childKey}`);
    }

    const child: WorkflowChild = { ...input, status: "pending", retryCount: 0 };
    this.children.set(input.childKey, child);
    return { ...child };
  }

  async completeChild(childKey: string): Promise<void> {
    const child = this.requireChild(childKey);
    child.status = "completed";
    child.failureCode = undefined;
  }

  async failChild(childKey: string, failureCode: ChildFailureCode): Promise<void> {
    const child = this.requireChild(childKey);
    child.status = "failed";
    child.failureCode = failureCode;
  }

  async retryChild(childKey: string): Promise<WorkflowChild> {
    const child = this.requireChild(childKey);

    if (child.status !== "failed" || !child.failureCode || !RETRYABLE_FAILURES.has(child.failureCode)) {
      throw new Error(`child is not retryable: ${childKey}`);
    }

    child.status = "pending";
    child.failureCode = undefined;
    child.retryCount += 1;
    return { ...child };
  }

  async getCompletedChildren(stage: WorkflowStageKey): Promise<string[]> {
    return [...this.children.values()]
      .filter((child) => child.stage === stage && child.status === "completed")
      .map((child) => child.childKey)
      .sort();
  }

  async getChild(childKey: string): Promise<WorkflowChild> {
    return { ...this.requireChild(childKey) };
  }

  private requireChild(childKey: string): WorkflowChild {
    const child = this.children.get(childKey);

    if (!child) {
      throw new Error(`child not found: ${childKey}`);
    }

    return child;
  }
}
