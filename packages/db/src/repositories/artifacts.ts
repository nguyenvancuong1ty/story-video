import { randomUUID } from "node:crypto";

export type StoredArtifact<T = unknown> = {
  id: string;
  projectId: string;
  kind: string;
  version: number;
  inputArtifactIds: string[];
  payload: T;
  createdAt: string;
};

export type ArtifactRepository = {
  createVersion<T>(projectId: string, kind: string, inputArtifactIds: string[], payload: T): Promise<StoredArtifact<T>>;
  traceInputs(artifactId: string): Promise<string[]>;
};

export const createMemoryArtifactRepository = (): ArtifactRepository => {
  const artifacts = new Map<string, StoredArtifact>();

  return {
    async createVersion(projectId, kind, inputArtifactIds, payload) {
      const version = [...artifacts.values()].filter((artifact) => artifact.projectId === projectId && artifact.kind === kind).length + 1;
      const artifact: StoredArtifact = {
        id: randomUUID(),
        projectId,
        kind,
        version,
        inputArtifactIds: [...inputArtifactIds],
        payload,
        createdAt: new Date().toISOString()
      };

      artifacts.set(artifact.id, artifact);
      return artifact as StoredArtifact<typeof payload>;
    },
    async traceInputs(artifactId) {
      const visited = new Set<string>();
      const lineage: string[] = [];

      const visit = (id: string): void => {
        const artifact = artifacts.get(id);
        if (!artifact) {
          throw new Error(`artifact not found: ${id}`);
        }

        for (const inputId of artifact.inputArtifactIds) {
          if (!visited.has(inputId)) {
            visited.add(inputId);
            lineage.push(inputId);
            visit(inputId);
          }
        }
      };

      visit(artifactId);
      return lineage;
    }
  };
};
