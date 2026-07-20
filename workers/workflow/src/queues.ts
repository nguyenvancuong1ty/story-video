import { Queue } from "bullmq";

export const WORKFLOW_QUEUE_NAME = "knowledge-story-video-workflow";

export const createChildJobId = (executionId: string, childKey: string): string => `${executionId}:${childKey}`;

export const createWorkflowQueue = (connection: unknown): Queue =>
  new Queue(WORKFLOW_QUEUE_NAME, { connection: connection as never });
