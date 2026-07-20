import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const measureAudioDuration = async (path: string): Promise<number> => {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path]);
  const durationMs = Math.round(Number.parseFloat(stdout.trim()) * 1000);

  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error("audio has zero duration");
  return durationMs;
};
