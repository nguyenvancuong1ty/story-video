import type { ArtifactStore } from "./artifact-store.js";

export const createS3ArtifactStore = (operations: ArtifactStore): ArtifactStore => operations;
