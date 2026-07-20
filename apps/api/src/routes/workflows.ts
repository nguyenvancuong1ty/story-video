import type { FastifyInstance } from "fastify";

import type { ProjectService, StageCommand } from "../services/project-service.js";

const COMMANDS = new Set<StageCommand>(["run", "cancel", "retry", "approve", "reject", "rerun_from_here"]);

export const registerWorkflowRoutes = (app: FastifyInstance, projects: ProjectService): void => {
  app.get("/projects/:projectId/workflow", async (request) => projects.getWorkflow((request.params as { projectId: string }).projectId));

  app.post("/projects/:projectId/stages/:stage/commands", async (request, reply) => {
    const { projectId, stage } = request.params as { projectId: string; stage: string };
    const type = (request.body as { type?: string } | undefined)?.type;
    if (!type || !COMMANDS.has(type as StageCommand)) return reply.code(400).send({ error: "invalid command" });

    try {
      return reply.code(202).send({ stage, ...projects.command(projectId, stage, type as StageCommand) });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "command failed" });
    }
  });
};
