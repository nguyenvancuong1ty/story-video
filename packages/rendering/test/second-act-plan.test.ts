import { describe, expect, it } from "vitest";

import {
  isCommerciallySafeStockClip,
  motionForTreatment,
  planShotTimings,
  selectStockClip
} from "../src/second-act-plan.js";

describe("Second Act stock license filtering", () => {
  it("accepts provider licenses designed for commercial reuse", () => {
    expect(isCommerciallySafeStockClip({ path: "a.mp4", source: "Pexels", license: "" })).toBe(true);
    expect(isCommerciallySafeStockClip({ path: "b.mp4", source: "Wikimedia", license: "CC0 1.0" })).toBe(true);
    expect(isCommerciallySafeStockClip({ path: "c.mp4", source: "Wikimedia", license: "CC BY 4.0" })).toBe(true);
  });

  it("rejects unknown and restrictive licenses in safe mode", () => {
    expect(isCommerciallySafeStockClip({ path: "a.mp4", source: "Archive.org" })).toBe(false);
    expect(isCommerciallySafeStockClip({ path: "b.mp4", source: "Wikimedia", license: "CC BY-NC 4.0" })).toBe(false);
    expect(isCommerciallySafeStockClip({ path: "c.mp4", source: "Wikimedia", license: "CC BY-SA 4.0" })).toBe(false);
    expect(isCommerciallySafeStockClip({ path: "d.mp4", source: "Other", license: "All Rights Reserved" })).toBe(false);
  });

  it("prefers a clip that has not already been used", () => {
    const candidates = [
      { path: "used.mp4", source: "Pexels" },
      { path: "fresh.mp4", source: "Pexels" }
    ];
    expect(selectStockClip(candidates, new Set(["used.mp4"]))).toEqual({
      clip: candidates[1],
      reused: false
    });
  });
});

describe("Second Act shot timing", () => {
  it("fills the beat exactly while overlapping adjacent shots", () => {
    const totalFrames = 540;
    const timings = planShotTimings(totalFrames, [5.8, 4.6, 5.2, 4.4], {
      fps: 30,
      overlapFrames: 8,
      minimumSeconds: 3.2
    });

    expect(timings).toHaveLength(4);
    expect(timings[0].from).toBe(0);
    expect(timings.slice(1).every((timing) => timing.overlapInFrames === 8)).toBe(true);
    const final = timings.at(-1)!;
    expect(final.from + final.durationInFrames).toBe(totalFrames);
    for (let index = 1; index < timings.length; index += 1) {
      expect(timings[index].from).toBe(
        timings[index - 1].from + timings[index - 1].durationInFrames - timings[index].overlapInFrames
      );
    }
  });

  it("produces deterministic camera motion", () => {
    expect(motionForTreatment("pan-left", "beat-1")).toEqual(
      motionForTreatment("pan-left", "beat-1")
    );
    expect(motionForTreatment("slow-push-in", "beat-1").endScale).toBeGreaterThan(
      motionForTreatment("slow-push-in", "beat-1").startScale
    );
  });
});
