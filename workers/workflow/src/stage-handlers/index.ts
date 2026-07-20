export type StageHandlerRecord = Record<string, (input: unknown) => Promise<unknown>>;

export const stageHandlers: StageHandlerRecord = {};
