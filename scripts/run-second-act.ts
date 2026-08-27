import { execFile } from "node:child_process";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { promisify } from "node:util";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

import { CapCutTtsProvider } from "../packages/audio/src/capcut-provider.js";
import { LocalOpenAiCompatibleProvider } from "../packages/editorial/src/local-llm-provider.js";
import { generateSecondActStory } from "../packages/editorial/src/second-act.js";
import {
  deterministicUnit,
  motionForTreatment,
  planShotTimings,
  playbackRateForTreatment,
  selectStockClip,
  type LicenseMode,
  type MotionTreatment,
  type StockClipCandidate
} from "../packages/rendering/src/second-act-plan.js";
import { verifyRender } from "./verify-render.js";

const execFileAsync = promisify(execFile);
const FPS = 30;

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

const fileExists = async (filePath: string): Promise<boolean> =>
  access(filePath).then(() => true).catch(() => false);

const mediaDurationSeconds = async (filePath: string): Promise<number> => {
  const { stdout } = await execFileAsync(ffprobeInstaller.path, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Could not measure media duration: ${filePath}`);
  return duration;
};

type OpenMontageClip = StockClipCandidate & {
  slot_id?: string;
  path?: string;
  source?: string;
  source_url?: string;
  license?: string;
  duration?: number;
  query?: string;
};

type OpenMontageResult = {
  success: boolean;
  error?: string | null;
  data?: { clips?: OpenMontageClip[] };
};

type SelectedShot = {
  slotId: string;
  query: string;
  clip: OpenMontageClip & { path: string };
  reused: boolean;
};

const parseArguments = () => {
  const args = process.argv.slice(2);
  const topicIndex = args.indexOf("--topic");
  const topic = topicIndex >= 0 ? args[topicIndex + 1] : undefined;
  const minutesIndex = args.indexOf("--minutes");
  const minutes = minutesIndex >= 0 ? Number(args[minutesIndex + 1]) : 4;
  const licenseIndex = args.indexOf("--license-mode");
  const licenseMode = (licenseIndex >= 0 ? args[licenseIndex + 1] : process.env.SECOND_ACT_LICENSE_MODE ?? "safe") as LicenseMode;
  if (!topic) throw new Error('Usage: pnpm second-act:pilot -- --topic "..." [--minutes 4] [--license-mode safe|all]');
  if (!Number.isFinite(minutes) || minutes < 3 || minutes > 8) throw new Error("--minutes must be between 3 and 8 for pilot mode");
  if (licenseMode !== "safe" && licenseMode !== "all") throw new Error("--license-mode must be safe or all");
  return { topic, minutes, licenseMode };
};

const findOptionalAudio = async (directory: string, cue: string): Promise<string | undefined> => {
  for (const extension of [".mp3", ".wav", ".m4a", ".aac"]) {
    const candidate = resolve(directory, `${cue}${extension}`);
    if (await fileExists(candidate)) return candidate;
  }
  return undefined;
};

const main = async (): Promise<void> => {
  if (await fileExists(resolve(".env"))) process.loadEnvFile(resolve(".env"));
  const { topic, minutes, licenseMode } = parseArguments();

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
  await Promise.all([
    mkdir(audioDir, { recursive: true }),
    mkdir(footageDir, { recursive: true }),
    mkdir(publicAudioDir, { recursive: true }),
    mkdir(publicVideoDir, { recursive: true })
  ]);

  await writeFile(resolve(runDir, "story.json"), `${JSON.stringify(story, null, 2)}\n`);

  const clipsPerQuery = Math.max(1, Math.min(4, Number(process.env.SECOND_ACT_CLIPS_PER_QUERY ?? "2")));
  const configuredSources = (process.env.SECOND_ACT_STOCK_SOURCES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const visualSpec: Record<string, unknown> = {
    clips_per_query: clipsPerQuery,
    extract_thumbnails: true,
    timeout_seconds: 1800,
    filters: { orientation: "landscape", min_width: 1280, min_duration: 4 },
    queries: story.beats.flatMap((beat) => beat.visualQueries.map((query, queryIndex) => ({
      slot_id: `${beat.id}__shot-${String(queryIndex + 1).padStart(2, "0")}`,
      query,
      kind: "video"
    })))
  };
  if (configuredSources.length > 0) visualSpec.sources = configuredSources;
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
    durations.set(beat.id, await mediaDurationSeconds(localAudio));
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
  await execFileAsync(openMontagePython, retrievalArgs, { maxBuffer: 30 * 1024 * 1024 });

  const retrieval = JSON.parse(await readFile(retrievalResultPath, "utf8")) as OpenMontageResult;
  if (!retrieval.success) throw new Error(`OpenMontage retrieval failed: ${retrieval.error ?? "unknown error"}`);
  const clips = retrieval.data?.clips ?? [];
  const candidatesBySlot = new Map<string, OpenMontageClip[]>();
  for (const clip of clips) {
    if (!clip.slot_id || !clip.path) continue;
    const candidates = candidatesBySlot.get(clip.slot_id) ?? [];
    candidates.push(clip);
    candidatesBySlot.set(clip.slot_id, candidates);
  }

  const usedPaths = new Set<string>();
  const selectedByBeat = new Map<string, SelectedShot[]>();
  for (const beat of story.beats) {
    const selected: SelectedShot[] = [];
    for (const [queryIndex, query] of beat.visualQueries.entries()) {
      const slotId = `${beat.id}__shot-${String(queryIndex + 1).padStart(2, "0")}`;
      const choice = selectStockClip(candidatesBySlot.get(slotId) ?? [], usedPaths, licenseMode);
      if (!choice) continue;
      usedPaths.add(choice.clip.path);
      selected.push({ slotId, query, clip: choice.clip, reused: choice.reused });
    }
    if (selected.length < 3) {
      throw new Error(
        `Only ${selected.length} safe, usable shots were found for ${beat.id}. `
        + "Add PEXELS_API_KEY, increase SECOND_ACT_CLIPS_PER_QUERY, or inspect openmontage-result.json."
      );
    }
    selectedByBeat.set(beat.id, selected);
  }

  const ambienceDirectory = process.env.SECOND_ACT_AMBIENCE_DIR?.trim();
  const copiedAmbience = new Map<string, string>();
  const resolveAmbiencePath = async (cue: string): Promise<string | undefined> => {
    if (!ambienceDirectory || cue === "none") return undefined;
    if (copiedAmbience.has(cue)) return copiedAmbience.get(cue);
    const source = await findOptionalAudio(ambienceDirectory, cue);
    if (!source) return undefined;
    const targetName = `ambience-${cue}${extname(source)}`;
    await copyFile(source, resolve(publicAudioDir, targetName));
    const relative = `runs/second-act/${slug}/audio/${targetName}`;
    copiedAmbience.set(cue, relative);
    return relative;
  };

  let musicPath: string | undefined;
  const configuredMusic = process.env.SECOND_ACT_MUSIC_PATH?.trim();
  if (configuredMusic) {
    if (!await fileExists(configuredMusic)) throw new Error(`SECOND_ACT_MUSIC_PATH does not exist: ${configuredMusic}`);
    const targetName = `music${extname(configuredMusic) || ".mp3"}`;
    await copyFile(configuredMusic, resolve(publicAudioDir, targetName));
    musicPath = `runs/second-act/${slug}/audio/${targetName}`;
  }

  const treatments: MotionTreatment[] = [
    "slow-push-in",
    "pan-left",
    "locked",
    "pan-right",
    "slow-pull-out",
    "slight-slow-motion"
  ];
  const targetShotSeconds = [5.8, 4.6, 5.2, 4.4, 5.5];
  let cursor = 0;
  const renderBeats: Array<{
    id: string;
    from: number;
    durationInFrames: number;
    audioPath: string;
    subtitle: string;
    visualTone: "cool" | "neutral" | "warm" | "hopeful";
    chapterLabel?: string;
    ambiencePath?: string;
    shots: Array<{
      id: string;
      from: number;
      durationInFrames: number;
      overlapInFrames: number;
      videoPath: string;
      sourceStartInFrames: number;
      playbackRate: number;
      motion: ReturnType<typeof motionForTreatment>;
      overlayText?: string;
    }>;
  }> = [];
  const provenance: Array<Record<string, unknown>> = [];

  for (const [beatIndex, beat] of story.beats.entries()) {
    const durationInFrames = Math.max(FPS, Math.ceil((durations.get(beat.id) ?? 1) * FPS));
    const available = selectedByBeat.get(beat.id) ?? [];
    const desiredCount = Math.max(3, Math.min(5, available.length, Math.floor(durationInFrames / (FPS * 4.1))));
    const selectedShots = available.slice(0, desiredCount);
    const timings = planShotTimings(
      durationInFrames,
      targetShotSeconds.slice(0, selectedShots.length),
      { fps: FPS, overlapFrames: 8, minimumSeconds: 3.2 }
    );
    const shots = [] as Array<{
      id: string;
      from: number;
      durationInFrames: number;
      overlapInFrames: number;
      videoPath: string;
      sourceStartInFrames: number;
      playbackRate: number;
      motion: ReturnType<typeof motionForTreatment>;
      overlayText?: string;
    }>;

    for (const [shotIndex, selected] of selectedShots.entries()) {
      const sourcePath = selected.clip.path;
      const extension = extname(sourcePath) || ".mp4";
      const targetName = `${beat.id}-shot-${String(shotIndex + 1).padStart(2, "0")}${extension}`;
      await copyFile(sourcePath, resolve(publicVideoDir, targetName));
      const timing = timings[shotIndex];
      const treatment = treatments[(beatIndex + shotIndex) % treatments.length];
      const playbackRate = playbackRateForTreatment(treatment);
      const measuredDuration = Number(selected.clip.duration);
      const sourceDuration = Number.isFinite(measuredDuration) && measuredDuration > 0
        ? measuredDuration
        : await mediaDurationSeconds(sourcePath);
      const consumedSeconds = timing.durationInFrames / FPS * playbackRate;
      const maximumStartSeconds = Math.max(0, sourceDuration - consumedSeconds - 0.35);
      const sourceStartInFrames = Math.floor(
        maximumStartSeconds * FPS * deterministicUnit(`${beat.id}:${selected.slotId}:${sourcePath}`)
      );
      const shouldShowKeyPhrase = shotIndex === 1 && (beatIndex === 0 || beatIndex % 4 === 1 || beatIndex === story.beats.length - 1);

      shots.push({
        id: selected.slotId,
        from: timing.from,
        durationInFrames: timing.durationInFrames,
        overlapInFrames: timing.overlapInFrames,
        videoPath: `runs/second-act/${slug}/video/${targetName}`,
        sourceStartInFrames,
        playbackRate,
        motion: motionForTreatment(treatment, `${beat.id}:${shotIndex}`),
        overlayText: shouldShowKeyPhrase ? beat.keyPhrase : undefined
      });
      provenance.push({
        beatId: beat.id,
        shotId: selected.slotId,
        query: selected.query,
        localFile: basename(sourcePath),
        copiedAs: targetName,
        provider: selected.clip.source,
        sourceUrl: selected.clip.source_url,
        license: selected.clip.license,
        sourceDurationSeconds: sourceDuration,
        sourceStartInFrames,
        treatment,
        reused: selected.reused
      });
    }

    renderBeats.push({
      id: beat.id,
      from: cursor,
      durationInFrames,
      audioPath: `runs/second-act/${slug}/audio/${beat.id}.mp3`,
      subtitle: beat.subtitle,
      visualTone: beat.visualTone,
      chapterLabel: beatIndex % 4 === 0 ? `Chapter ${Math.floor(beatIndex / 4) + 1} · ${beat.subtitle}` : undefined,
      ambiencePath: await resolveAmbiencePath(beat.ambience),
      shots
    });
    cursor += durationInFrames;
  }

  const props = { title: story.title, beats: renderBeats, musicPath };
  const propsPath = resolve(runDir, "remotion-props.json");
  await writeFile(propsPath, `${JSON.stringify(props, null, 2)}\n`);
  await writeFile(resolve(runDir, "edit-plan.json"), `${JSON.stringify({ fps: FPS, totalFrames: cursor, beats: renderBeats }, null, 2)}\n`);
  await writeFile(resolve(runDir, "footage-provenance.json"), `${JSON.stringify({ licenseMode, clips: provenance }, null, 2)}\n`);

  const mp4Path = resolve(runDir, `${slug}.mp4`);
  await execFileAsync("pnpm", [
    "--filter", "@ksvf/remotion",
    "exec", "remotion", "render",
    "src/index.ts", "SecondActStory", mp4Path,
    "--props", propsPath
  ], { maxBuffer: 30 * 1024 * 1024 });
  const verified = await verifyRender(mp4Path, undefined, { width: 1920, height: 1080, fps: FPS });
  const publishingPackage = {
    title: story.title,
    description: `${story.description}\n\n${story.fictionDisclosure}`,
    audiencePromise: story.audiencePromise,
    video: mp4Path,
    verified,
    storyFile: resolve(runDir, "story.json"),
    editPlanFile: resolve(runDir, "edit-plan.json"),
    footageProvenanceFile: resolve(runDir, "footage-provenance.json"),
    stockLicenseMode: licenseMode,
    musicIncluded: Boolean(musicPath),
    ambienceCuesIncluded: copiedAmbience.size
  };
  await writeFile(resolve(runDir, "publishing-package.json"), `${JSON.stringify(publishingPackage, null, 2)}\n`);
  console.log(mp4Path);
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
