import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { promisify } from "node:util";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

import { CapCutTtsProvider } from "../packages/audio/src/capcut-provider.js";
import { LocalOpenAiCompatibleProvider } from "../packages/editorial/src/local-llm-provider.js";
import { generateSecondActStory } from "../packages/editorial/src/second-act.js";
import { verifyRender } from "./verify-render.js";

const execFileAsync = promisify(execFile);

const slugify = (value: string): string => value
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 60) || "second-act-pilot";

const required = (name: string, fallback = ""): string => {
  const value = process.env[name]?.trim() || fallback;
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const audioDurationSeconds = async (filePath: string): Promise<number> => {
  const { stdout } = await execFileAsync(ffprobeInstaller.path, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Could not measure audio duration: ${filePath}`);
  return duration;
};

type OpenMontageClip = {
  slot_id?: string;
  path?: string;
  source?: string;
  source_url?: string;
  license?: string;
};

type OpenMontageResult = {
  success: boolean;
  error?: string | null;
  data?: { clips?: OpenMontageClip[] };
};

const parseArguments = () => {
  const args = process.argv.slice(2);
  const topicIndex = args.indexOf("--topic");
  const topic = topicIndex >= 0 ? args[topicIndex + 1] : undefined;
  const minutesIndex = args.indexOf("--minutes");
  const minutes = minutesIndex >= 0 ? Number(args[minutesIndex + 1]) : 4;
  if (!topic) throw new Error('Usage: pnpm second-act:pilot -- --topic "..." [--minutes 4]');
  if (!Number.isFinite(minutes) || minutes < 3 || minutes > 8) throw new Error("--minutes must be between 3 and 8 for pilot mode");
  return { topic, minutes };
};

const main = async (): Promise<void> => {
  if (await readFile(resolve(".env"), "utf8").then(() => true).catch(() => false)) process.loadEnvFile(resolve(".env"));
  const { topic, minutes } = parseArguments();

  const llmBaseUrl = required("LOCAL_LLM_BASE_URL", "http://localhost:20128/v1");
  const llmModel = required("LOCAL_LLM_MODEL", "cx/gpt-5.6-terra");
  const capcutBaseUrl = required("CAPCUT_TTS_BASE_URL", "http://127.0.0.1:8765");
  const voiceIndex = Number(process.env.CAPCUT_TTS_VOICE_INDEX ?? "0");
  const rate = process.env.CAPCUT_TTS_RATE ?? "1.0";

  const languageModel = new LocalOpenAiCompatibleProvider(llmBaseUrl, llmModel);
  const story = await generateSecondActStory(languageModel, { topic, model: llmModel, targetMinutes: minutes });
  const slug = slugify(story.title);
  const runDir = resolve("out/second-act", slug);
  const audioDir = resolve(runDir, "audio");
  const footageDir = resolve(runDir, "footage");
  const publicRunDir = resolve("apps/remotion/public/runs/second-act", slug);
  const publicAudioDir = resolve(publicRunDir, "audio");
  const publicVideoDir = resolve(publicRunDir, "video");
  await Promise.all([mkdir(audioDir, { recursive: true }), mkdir(footageDir, { recursive: true }), mkdir(publicAudioDir, { recursive: true }), mkdir(publicVideoDir, { recursive: true })]);

  await writeFile(resolve(runDir, "story.json"), `${JSON.stringify(story, null, 2)}\n`);

  const visualSpec = {
    clips_per_query: 1,
    extract_thumbnails: true,
    timeout_seconds: 1200,
    filters: { orientation: "landscape", min_width: 1280, min_duration: 4 },
    queries: story.beats.flatMap((beat) => beat.visualQueries.map((query) => ({ slot_id: beat.id, query, kind: "video" })))
  };
  const visualSpecPath = resolve(runDir, "visual-spec.json");
  await writeFile(visualSpecPath, `${JSON.stringify(visualSpec, null, 2)}\n`);

  const tts = new CapCutTtsProvider({ baseUrl: capcutBaseUrl, voiceIndex, rate, durationMs: 12_000 });
  const durations = new Map<string, number>();
  for (const beat of story.beats) {
    const result = await tts.synthesize({ text: beat.narration, language: "en-US", voiceId: String(voiceIndex) });
    const localAudio = resolve(audioDir, `${beat.id}.mp3`);
    await writeFile(localAudio, result.bytes);
    const publicAudio = resolve(publicAudioDir, `${beat.id}.mp3`);
    await copyFile(localAudio, publicAudio);
    durations.set(beat.id, await audioDurationSeconds(localAudio));
  }

  const openMontagePython = process.env.OPENMONTAGE_PYTHON?.trim() || (process.platform === "win32" ? "python" : "python3");
  const retrievalResultPath = resolve(runDir, "openmontage-result.json");
  const retrievalArgs = [
    "scripts/openmontage-retrieve.py",
    "--spec", visualSpecPath,
    "--output", footageDir,
    "--result", retrievalResultPath
  ];
  if (process.env.OPENMONTAGE_PATH?.trim()) retrievalArgs.push("--openmontage", process.env.OPENMONTAGE_PATH.trim());
  await execFileAsync(openMontagePython, retrievalArgs, { maxBuffer: 10 * 1024 * 1024 });

  const retrieval = JSON.parse(await readFile(retrievalResultPath, "utf8")) as OpenMontageResult;
  if (!retrieval.success) throw new Error(`OpenMontage retrieval failed: ${retrieval.error ?? "unknown error"}`);
  const clips = retrieval.data?.clips ?? [];
  const firstClipByBeat = new Map<string, OpenMontageClip>();
  for (const clip of clips) {
    if (clip.slot_id && clip.path && !firstClipByBeat.has(clip.slot_id)) firstClipByBeat.set(clip.slot_id, clip);
  }

  const missing = story.beats.filter((beat) => !firstClipByBeat.has(beat.id)).map((beat) => beat.id);
  if (missing.length) throw new Error(`No usable stock footage for beats: ${missing.join(", ")}`);

  let cursor = 0;
  const renderBeats = [] as Array<{ id: string; from: number; durationInFrames: number; audioPath: string; videoPath: string; subtitle: string }>;
  const provenance = [] as Array<Record<string, unknown>>;
  for (const beat of story.beats) {
    const clip = firstClipByBeat.get(beat.id)!;
    const sourcePath = clip.path!;
    const extension = extname(sourcePath) || ".mp4";
    const targetName = `${beat.id}${extension}`;
    await copyFile(sourcePath, resolve(publicVideoDir, targetName));
    const durationInFrames = Math.max(30, Math.ceil((durations.get(beat.id) ?? 1) * 30));
    renderBeats.push({
      id: beat.id,
      from: cursor,
      durationInFrames,
      audioPath: `runs/second-act/${slug}/audio/${beat.id}.mp3`,
      videoPath: `runs/second-act/${slug}/video/${targetName}`,
      subtitle: beat.subtitle
    });
    cursor += durationInFrames;
    provenance.push({ beatId: beat.id, localFile: basename(sourcePath), provider: clip.source, sourceUrl: clip.source_url, license: clip.license });
  }

  const props = { title: story.title, beats: renderBeats };
  const propsPath = resolve(runDir, "remotion-props.json");
  await writeFile(propsPath, `${JSON.stringify(props, null, 2)}\n`);
  await writeFile(resolve(runDir, "footage-provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);

  const mp4Path = resolve(runDir, `${slug}.mp4`);
  await execFileAsync("pnpm", ["--filter", "@ksvf/remotion", "exec", "remotion", "render", "src/index.ts", "SecondActStory", mp4Path, "--props", propsPath], { maxBuffer: 10 * 1024 * 1024 });
  const verified = await verifyRender(mp4Path, undefined, { width: 1920, height: 1080, fps: 30 });
  const publishingPackage = {
    title: story.title,
    description: `${story.description}\n\n${story.fictionDisclosure}`,
    audiencePromise: story.audiencePromise,
    video: mp4Path,
    verified,
    storyFile: resolve(runDir, "story.json"),
    footageProvenanceFile: resolve(runDir, "footage-provenance.json")
  };
  await writeFile(resolve(runDir, "publishing-package.json"), `${JSON.stringify(publishingPackage, null, 2)}\n`);
  console.log(mp4Path);
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
