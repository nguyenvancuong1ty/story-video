export type CostRecord = {
  projectId: string;
  executionId: string;
  stage: string;
  provider: string;
  model: string;
  units: number;
  amountUsd: number;
  childArtifactIds: string[];
  recordedAt: string;
};

export const sumProjectCost = (records: ReadonlyArray<Pick<CostRecord, "amountUsd">>): number =>
  Number(records.reduce((total, record) => total + record.amountUsd, 0).toFixed(6));
