import { expect, it } from "vitest";

import { buildApp } from "../src/app.js";

it("starts a stage through the validated command endpoint", async () => {
  const app = buildApp();
  const response = await app.inject({ method: "POST", url: "/projects/prj_1/stages/RESEARCH/commands", payload: { type: "run" } });

  expect(response.statusCode).toBe(202);
  expect(JSON.parse(response.body)).toMatchObject({ stage: "RESEARCH", status: "running" });
  await app.close();
});

it("rejects approval for a stage without an enabled gate", async () => {
  const app = buildApp();
  const response = await app.inject({ method: "POST", url: "/projects/prj_1/stages/RESEARCH/commands", payload: { type: "approve" } });

  expect(response.statusCode).toBe(400);
  await app.close();
});

it("persists a stage command for the next workflow read", async () => {
  const app = buildApp();

  await app.inject({ method: "POST", url: "/projects/prj_1/stages/RESEARCH/commands", payload: { type: "run" } });
  const workflow = await app.inject({ method: "GET", url: "/projects/prj_1/workflow" });

  expect(JSON.parse(workflow.body).find((stage: { key: string }) => stage.key === "RESEARCH")).toMatchObject({ status: "running", log: "run requested" });
  await app.close();
});
