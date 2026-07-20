import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

const execFileAsync = promisify(execFile);

export type RenderProbeResult = {
  streams: Array<{ codec_type: string; width?: number; height?: number; r_frame_rate?: string }>;
  format: { duration?: string };
};

export type RenderProbe = (filePath: string) => Promise<RenderProbeResult>;

export const resolveFfprobeExecutable = (environment: NodeJS.ProcessEnv = process.env): string => environment.FFPROBE_PATH?.trim() || ffprobeInstaller.path;

const probeWithFfprobe: RenderProbe = async (filePath) => {
  const { stdout } = await execFileAsync(resolveFfprobeExecutable(), ["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", filePath]);
  return JSON.parse(stdout) as RenderProbeResult;
};

const frameRate = (value: string | undefined): number => {
  if (!value) return 0;
  const [numerator, denominator = "1"] = value.split("/");
  return Number(numerator) / Number(denominator);
};

export const verifyRender = async (filePath: string, probe: RenderProbe = probeWithFfprobe): Promise<{ width: number; height: number; fps: number; durationSeconds: number }> => {
  const result = await probe(filePath);
  const video = result.streams.find((stream) => stream.codec_type === "video");
  const audio = result.streams.find((stream) => stream.codec_type === "audio");
  if (!video) throw new Error("Missing video stream");
  if (!audio) throw new Error("Missing audio stream");
  if (video.width !== 1080 || video.height !== 1920) throw new Error(`Expected 1080x1920 video, received ${video.width ?? 0}x${video.height ?? 0}`);

  const fps = frameRate(video.r_frame_rate);
  if (Math.abs(fps - 30) > 0.001) throw new Error(`Expected 30 fps, received ${video.r_frame_rate ?? "unknown"}`);

  const durationSeconds = Number(result.format.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("Missing nonzero duration");
  return { width: video.width, height: video.height, fps, durationSeconds };
};

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  void (async () => {
    const filePath = process.argv[2];
    if (!filePath) throw new Error("Usage: verify-render <file.mp4>");
    const verified = await verifyRender(filePath);
    console.log(JSON.stringify(verified));
  })().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
