import type { CostRecord } from "./cost.js";

export type StageTelemetry = {
  projectId: string;
  executionId: string;
  stage: string;
  queueDelayMs: number;
  durationMs: number;
  retryReason?: string;
  provider?: string;
  model?: string;
  units?: number;
  childArtifactIds: string[];
  recordedAt: string;
};

export type ProjectTelemetry = {
  stages: StageTelemetry[];
  costs: CostRecord[];
  assetCacheHits: number;
};

export class TelemetryCollector {
  private readonly stages: StageTelemetry[] = [];
  private readonly costs: CostRecord[] = [];
  private assetCacheHits = 0;

  recordStage(record: StageTelemetry): void {
    this.stages.push({ ...record, childArtifactIds: [...record.childArtifactIds] });
  }

  recordCost(record: CostRecord): void {
    this.costs.push({ ...record, childArtifactIds: [...record.childArtifactIds] });
  }

  recordAssetCacheHit(): void {
    this.assetCacheHits += 1;
  }

  snapshot(): ProjectTelemetry {
    return {
      stages: this.stages.map((record) => ({ ...record, childArtifactIds: [...record.childArtifactIds] })),
      costs: this.costs.map((record) => ({ ...record, childArtifactIds: [...record.childArtifactIds] })),
      assetCacheHits: this.assetCacheHits
    };
  }
}
