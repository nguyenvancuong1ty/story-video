import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";

import { LocalChatImageProvider } from "../packages/assets/src/local-chat-image-provider.js";
import { CapCutTtsProvider } from "../packages/audio/src/capcut-provider.js";
import { LocalOpenAiCompatibleProvider } from "../packages/editorial/src/local-llm-provider.js";
import { buildRomeVideoProps } from "../apps/remotion/src/run-props.js";
import { assertCredentialedPreflight, loadCredentialedConfig } from "../packages/test-kit/src/credentialed/config.js";
import { runCredentialedRome } from "../packages/test-kit/src/credentialed/rome-run.js";
import { createPompeiiJapanesePilot, createPyramidsJapanesePilot, createRomeJapanesePilot, runPilot } from "../packages/test-kit/src/pilots/index.js";
import { verifyRender } from "./verify-render.js";

const execFileAsync = promisify(execFile);

const pilots = {
  "rome-ja": createRomeJapanesePilot,
  "pompeii-ja": createPompeiiJapanesePilot,
  "pyramids-ja": createPyramidsJapanesePilot
} as const;

type PilotId = keyof typeof pilots | "rome-vi";
export type ParsedPilotArguments = { pilot: PilotId; credentialed: boolean };

export const parsePilotArguments = (arguments_: string[]): ParsedPilotArguments => {
  const pilotIndex = arguments_.indexOf("--pilot");
  const pilot = arguments_[pilotIndex + 1] as PilotId | undefined;
  if (!pilot || (!(pilot in pilots) && pilot !== "rome-vi")) throw new Error("Usage: run-pilot --pilot rome-ja|pompeii-ja|pyramids-ja|rome-vi [--credentialed]");
  const credentialed = arguments_.includes("--credentialed");
  if (credentialed && pilot !== "rome-vi") throw new Error("--credentialed currently supports rome-vi only");
  return { pilot, credentialed };
};

export const copyRunMedia = async (beats: Array<{ id: string; audioPath: string; shots: Array<{ id: string; layers: Array<{ assetPath: string }> }> }>): Promise<void> => {
  const publicDirectory = resolve("apps/remotion/public/runs/rome-vi");
  const media = beats.flatMap((beat) => [
    { source: beat.audioPath, target: resolve(publicDirectory, "audio", `${beat.id}.mp3`) },
    ...beat.shots.flatMap((shot) => shot.layers.map((layer) => ({ source: layer.assetPath, target: resolve(publicDirectory, "assets", shot.id, basename(layer.assetPath)) })))
  ]);
  await Promise.all(media.map(async ({ source, target }) => { await mkdir(resolve(target, ".."), { recursive: true }); await copyFile(source, target); }));
};

const runCredentialedPilot = async (): Promise<string> => {
  if (existsSync(resolve(".env"))) process.loadEnvFile(resolve(".env"));
  const config = loadCredentialedConfig(process.env);
  await assertCredentialedPreflight(config);

  const outputDirectory = resolve("out/rome-vi");
  const result = await runCredentialedRome({
    config,
    languageModel: new LocalOpenAiCompatibleProvider(config.localLlmBaseUrl, config.localLlmModel),
    imageProvider: new LocalChatImageProvider({ baseUrl: config.localImageBaseUrl, model: config.localImageModel }),
    ttsProvider: new CapCutTtsProvider({ baseUrl: config.capcutTtsBaseUrl, voiceIndex: config.capcutTtsVoiceIndex, rate: config.capcutTtsRate, durationMs: 12_000 }),
    outputDirectory
  });

  await copyRunMedia(result.beats);
  const propsPath = resolve("out/rome-vi.remotion-props.json");
  await writeFile(propsPath, `${JSON.stringify(buildRomeVideoProps({ beats: result.beats }), null, 2)}\n`);
  const mp4Path = resolve("out/rome-vi.mp4");
  await execFileAsync("pnpm", ["--filter", "@ksvf/remotion", "exec", "remotion", "render", "src/index.ts", "KnowledgeStoryRun", mp4Path, "--props", propsPath]);
  const verified = await verifyRender(mp4Path);
  const publishingPath = resolve("out/rome-vi.publishing-package.json");
  await writeFile(publishingPath, `${JSON.stringify({ ...result, verified }, null, 2)}\n`);
  return publishingPath;
};

export const runPilotCommand = async (arguments_: string[]): Promise<string> => {
  const parsed = parsePilotArguments(arguments_);
  if (parsed.credentialed) return runCredentialedPilot();

  const result = await runPilot(pilots[parsed.pilot as keyof typeof pilots]());
  const outputDirectory = resolve("out");
  const outputPath = resolve(outputDirectory, `${parsed.pilot}.publishing-package.json`);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return outputPath;
};

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isCli) {
  void runPilotCommand(process.argv.slice(2)).then(console.log).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
