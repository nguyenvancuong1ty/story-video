export type WorkflowItem = { key: string; status: string; progress?: { completed: number; total: number }; costUsd?: number; warning?: string; log?: string };

export const toFlowNodes = (workflow: WorkflowItem[]) => workflow.map((stage, index) => ({
  id: stage.key,
  position: { x: (index % 3) * 250, y: Math.floor(index / 3) * 130 },
  data: { ...stage }
}));

export const toFlowEdges = (workflow: WorkflowItem[]) => workflow.slice(1).map((stage, index) => ({ id: `${workflow[index]!.key}-${stage.key}`, source: workflow[index]!.key, target: stage.key, animated: stage.status === "running" }));
