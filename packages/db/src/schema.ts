import { bigint, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey(),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    kind: text("kind").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("artifacts_project_kind_version").on(table.projectId, table.kind, table.version)]
);

export const artifactInputs = pgTable(
  "artifact_inputs",
  {
    artifactId: uuid("artifact_id").notNull().references(() => artifacts.id),
    inputArtifactId: uuid("input_artifact_id").notNull().references(() => artifacts.id)
  },
  (table) => [primaryKey({ columns: [table.artifactId, table.inputArtifactId] })]
);

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const stageExecutions = pgTable("stage_executions", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => workflowRuns.id),
  stage: text("stage").notNull(),
  status: text("status").notNull(),
  retryCount: integer("retry_count").notNull().default(0),
  costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0)
});

export const assetJobs = pgTable("asset_jobs", {
  id: uuid("id").primaryKey(),
  executionId: uuid("execution_id").notNull().references(() => stageExecutions.id),
  layerId: text("layer_id").notNull(),
  status: text("status").notNull()
});

export const audioJobs = pgTable("audio_jobs", {
  id: uuid("id").primaryKey(),
  executionId: uuid("execution_id").notNull().references(() => stageExecutions.id),
  sceneId: text("scene_id").notNull(),
  status: text("status").notNull()
});

export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: text("id").notNull(),
    version: integer("version").notNull(),
    payload: jsonb("payload").notNull()
  },
  (table) => [primaryKey({ columns: [table.id, table.version] })]
);

export const styleProfiles = pgTable(
  "style_profiles",
  {
    id: text("id").notNull(),
    version: integer("version").notNull(),
    payload: jsonb("payload").notNull()
  },
  (table) => [primaryKey({ columns: [table.id, table.version] })]
);
