import { z } from "zod";

export const ArtifactStatusSchema = z.enum(["draft", "ready", "approved", "rejected"]);
export const ArtifactSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  kind: z.string().min(1),
  version: z.number().int().positive(),
  status: ArtifactStatusSchema,
  inputArtifactIds: z.array(z.string().min(1)),
  payload: z.unknown(),
  createdAt: z.string().datetime(),
  createdBy: z.enum(["user", "worker"])
});

export type Artifact<T = unknown> = Omit<z.infer<typeof ArtifactSchema>, "payload"> & { payload: T };
