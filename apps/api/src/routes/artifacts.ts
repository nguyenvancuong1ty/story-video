import type { FastifyInstance } from "fastify";

export const registerArtifactRoutes = (app: FastifyInstance): void => {
  app.get("/projects/:projectId/artifacts", async () => []);
};
