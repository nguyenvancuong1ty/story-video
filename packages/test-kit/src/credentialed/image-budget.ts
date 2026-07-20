export class ImageBudget {
  private readonly approved = new Map<string, string>();
  private readonly reservations = new Set<string>();

  constructor(private readonly maximum: number) {}

  reserve(cacheKey: string): "cache-hit" | "reserved" {
    if (this.approved.has(cacheKey)) return "cache-hit";
    if (this.reservations.has(cacheKey)) return "reserved";
    if (this.approved.size + this.reservations.size >= this.maximum) {
      throw new Error(`image budget exhausted: maximum ${this.maximum} generated images per project`);
    }
    this.reservations.add(cacheKey);
    return "reserved";
  }

  commit(cacheKey: string, assetId: string): void {
    if (!this.reservations.delete(cacheKey)) throw new Error(`image cache key was not reserved: ${cacheKey}`);
    this.approved.set(cacheKey, assetId);
  }

  assetId(cacheKey: string): string | undefined {
    return this.approved.get(cacheKey);
  }

  get generatedImageCount(): number {
    return this.approved.size;
  }
}
