export type MemoryArtifactStore = {
  put(key: string, value: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
};

export const createMemoryArtifactStore = (): MemoryArtifactStore => {
  const values = new Map<string, Buffer>();

  return {
    async put(key, value) {
      values.set(key, Buffer.from(value));
    },
    async get(key) {
      const value = values.get(key);

      if (!value) {
        throw new Error(`missing artifact: ${key}`);
      }

      return Buffer.from(value);
    }
  };
};
