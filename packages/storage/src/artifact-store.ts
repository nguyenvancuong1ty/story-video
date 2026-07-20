export type ArtifactStore = {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
};
