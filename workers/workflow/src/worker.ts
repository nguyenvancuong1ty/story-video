import { Worker } from "bullmq";

import { WORKFLOW_QUEUE_NAME } from "./queues.js";

export const createWorkflowWorker = (connection: unknown, processor: (name: string, data: unknown) => Promise<unknown>): Worker =>
  new Worker(WORKFLOW_QUEUE_NAME, async (job) => processor(job.name, job.data), { connection: connection as never });
