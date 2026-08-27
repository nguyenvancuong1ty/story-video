export type LicenseMode = "safe" | "all";

export type StockClipCandidate = {
  slot_id?: string;
  path?: string;
  source?: string;
  source_url?: string;
  license?: string;
  duration?: number;
  query?: string;
};

export type SelectedStockClip = {
  clip: StockClipCandidate & { path: string };
  reused: boolean;
};

export type ShotTiming = {
  from: number;
  durationInFrames: number;
  overlapInFrames: number;
};

export type MotionTreatment =
  | "slow-push-in"
  | "slow-pull-out"
  | "pan-left"
  | "pan-right"
  | "locked"
  | "slight-slow-motion";

export type ShotMotion = {
  startScale: number;
  endScale: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
};

const normalized = (value: string | undefined): string => (value ?? "")
  .toLowerCase()
  .replace(/[_–—]/g, "-")
  .replace(/\s+/g, " ")
  .trim();

export const isCommerciallySafeStockClip = (
  clip: StockClipCandidate,
  mode: LicenseMode = "safe"
): boolean => {
  if (!clip.path) return false;
  if (mode === "all") return true;

  const source = normalized(clip.source);
  const license = normalized(clip.license);

  // These providers publish their own broad commercial-use licenses.
  if (source.includes("pexels") || source.includes("unsplash")) return true;

  if (!license) return false;

  // Reject restrictive variants before accepting the broader CC-BY family.
  if (
    /(^|[-\s])(nc|nd|sa)([-\s]|$)/.test(license)
    || license.includes("noncommercial")
    || license.includes("non-commercial")
    || license.includes("no derivatives")
    || license.includes("share alike")
    || license.includes("share-alike")
    || license.includes("all rights reserved")
  ) return false;

  if (
    license.includes("public domain")
    || license.includes("public-domain")
    || license.includes("cc0")
    || license.includes("creative commons zero")
  ) return true;

  return (
    /\bcc[-\s]?by\b/.test(license)
    || license.includes("creative commons attribution")
  );
};

export const selectStockClip = (
  candidates: StockClipCandidate[],
  usedPaths: ReadonlySet<string>,
  mode: LicenseMode = "safe"
): SelectedStockClip | undefined => {
  const usable = candidates.filter(
    (clip): clip is StockClipCandidate & { path: string } => isCommerciallySafeStockClip(clip, mode)
  );
  if (usable.length === 0) return undefined;

  const unique = usable.find((clip) => !usedPaths.has(clip.path));
  return unique
    ? { clip: unique, reused: false }
    : { clip: usable[0], reused: true };
};

export const planShotTimings = (
  totalFrames: number,
  targetSeconds: number[],
  options: { fps?: number; overlapFrames?: number; minimumSeconds?: number } = {}
): ShotTiming[] => {
  const fps = options.fps ?? 30;
  if (!Number.isInteger(totalFrames) || totalFrames <= 0) throw new Error("totalFrames must be a positive integer");
  if (!Number.isFinite(fps) || fps <= 0) throw new Error("fps must be positive");
  if (targetSeconds.length === 0) throw new Error("at least one shot is required");
  if (totalFrames < targetSeconds.length) throw new Error("totalFrames is too short for the requested shot count");

  const requestedOverlap = Math.max(0, Math.floor(options.overlapFrames ?? 6));
  const overlapFrames = Math.min(
    requestedOverlap,
    Math.max(0, Math.floor(totalFrames / (targetSeconds.length * 8)))
  );
  const expandedTotal = totalFrames + overlapFrames * (targetSeconds.length - 1);
  const requestedMinimum = Math.max(1, Math.round((options.minimumSeconds ?? 3) * fps));
  const minimumFrames = Math.max(1, Math.min(requestedMinimum, Math.floor(expandedTotal / targetSeconds.length)));
  const weights = targetSeconds.map((value) => Number.isFinite(value) && value > 0 ? value : 1);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);

  const durations = Array.from({ length: weights.length }, () => minimumFrames);
  const remaining = expandedTotal - minimumFrames * durations.length;
  if (remaining > 0) {
    const exactExtras = weights.map((weight) => remaining * weight / weightTotal);
    const floorExtras = exactExtras.map(Math.floor);
    for (let index = 0; index < durations.length; index += 1) durations[index] += floorExtras[index];

    let undistributed = remaining - floorExtras.reduce((sum, value) => sum + value, 0);
    const byRemainder = exactExtras
      .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (let index = 0; undistributed > 0; index = (index + 1) % byRemainder.length) {
      durations[byRemainder[index].index] += 1;
      undistributed -= 1;
    }
  }

  let cursor = 0;
  return durations.map((durationInFrames, index) => {
    const timing = {
      from: cursor,
      durationInFrames,
      overlapInFrames: index === 0 ? 0 : overlapFrames
    };
    cursor += durationInFrames - (index === durations.length - 1 ? 0 : overlapFrames);
    return timing;
  });
};

export const deterministicUnit = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

export const motionForTreatment = (treatment: MotionTreatment, seed: string): ShotMotion => {
  const offset = (deterministicUnit(seed) - 0.5) * 0.8;
  switch (treatment) {
    case "slow-pull-out":
      return { startScale: 1.09, endScale: 1.025, startX: offset, endX: -offset, startY: 0.3, endY: -0.2 };
    case "pan-left":
      return { startScale: 1.075, endScale: 1.075, startX: 1.8, endX: -1.8, startY: offset / 2, endY: -offset / 2 };
    case "pan-right":
      return { startScale: 1.075, endScale: 1.075, startX: -1.8, endX: 1.8, startY: -offset / 2, endY: offset / 2 };
    case "locked":
      return { startScale: 1.025, endScale: 1.035, startX: offset / 3, endX: -offset / 3, startY: 0, endY: 0 };
    case "slight-slow-motion":
      return { startScale: 1.04, endScale: 1.075, startX: -offset, endX: offset, startY: 0.2, endY: -0.2 };
    case "slow-push-in":
    default:
      return { startScale: 1.025, endScale: 1.09, startX: -offset, endX: offset, startY: -0.2, endY: 0.3 };
  }
};

export const playbackRateForTreatment = (treatment: MotionTreatment): number =>
  treatment === "slight-slow-motion" ? 0.9 : 1;
