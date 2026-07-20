import type { FastifyInstance } from "fastify";

export const registerProjectRoutes = (app: FastifyInstance): void => {
  app.get("/projects/:projectId", async (request) => ({ id: (request.params as { projectId: string }).projectId, truthPolicy: "factual", styleProfileRef: { id: "paper-collage", version: 1 } }));
};
