import Fastify from "fastify";

import { registerArtifactRoutes } from "./routes/artifacts.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerWorkflowRoutes } from "./routes/workflows.js";
import { ProjectService } from "./services/project-service.js";

export const buildApp = (projects = new ProjectService()) => {
  const app = Fastify({ logger: false });
  registerProjectRoutes(app);
  registerArtifactRoutes(app);
  registerWorkflowRoutes(app, projects);
  return app;
};
