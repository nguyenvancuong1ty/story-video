import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { OpenRouterImageProvider } from "../packages/assets/src/openrouter-provider.js";
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

type PilotId = keyof typeof pilots;
export type ParsedPilotArguments = { pilot: PilotId; credentialed: boolean };

export const parsePilotArguments = (arguments_: string[]): ParsedPilotArguments => {
  const pilotIndex = arguments_.indexOf("--pilot");
  const pilot = arguments_[pilotIndex + 1] as PilotId | undefined;
  if (!pilot || !(pilot in pilots)) throw new Error("Usage: run-pilot --pilot rome-ja|pompeii-ja|pyramids-ja [--credentialed]");
  const credentialed = arguments_.includes("--credentialed");
  if (credentialed && pilot !== "rome-ja") throw new Error("--credentialed currently supports rome-ja only");
  return { pilot, credentialed };
};

const copyRunMedia = async (sourceDirectory: string, scenes: Array<{ id: string; imagePath: string; audioPath: string }>): Promise<void> => {
  const publicDirectory = resolve("apps/remotion/public/runs/rome-ja");
  await Promise.all([mkdir(resolve(publicDirectory, "assets"), { recursive: true }), mkdir(resolve(publicDirectory, "audio"), { recursive: true })]);
  await Promise.all(scenes.flatMap((scene) => [
    copyFile(scene.imagePath, resolve(publicDirectory, "assets", `${scene.id}.png`)),
    copyFile(scene.audioPath, resolve(publicDirectory, "audio", `${scene.id}.mp3`))
  ]));
  if (sourceDirectory !== resolve("out/rome-ja")) throw new Error("credentialed output directory must be out/rome-ja");
};

const runCredentialedPilot = async (): Promise<string> => {
  if (existsSync(resolve(".env"))) process.loadEnvFile(resolve(".env"));
  const config = loadCredentialedConfig(process.env);
  await assertCredentialedPreflight(config);

  const outputDirectory = resolve("out/rome-ja");
  const result = await runCredentialedRome({
    config,
    languageModel: new LocalOpenAiCompatibleProvider(config.localLlmBaseUrl, config.localLlmModel),
    imageProvider: new OpenRouterImageProvider({ apiKey: config.openRouterApiKey, model: config.openRouterImageModel, baseUrl: config.openRouterImageBaseUrl }),
    ttsProvider: new CapCutTtsProvider({ baseUrl: config.capcutTtsBaseUrl, voiceIndex: config.capcutTtsVoiceIndex, rate: config.capcutTtsRate, durationMs: 10_000 }),
    outputDirectory
  });

  await copyRunMedia(outputDirectory, result.scenes);
  const propsPath = resolve("out/rome-ja.remotion-props.json");
  await writeFile(propsPath, `${JSON.stringify(buildRomeVideoProps({ scenes: result.scenes }), null, 2)}\n`);
  const mp4Path = resolve("out/rome-ja.mp4");
  await execFileAsync("pnpm", ["--filter", "@ksvf/remotion", "exec", "remotion", "render", "src/index.ts", "KnowledgeStoryRun", mp4Path, "--props", propsPath]);
  const verified = await verifyRender(mp4Path);
  const publishingPath = resolve("out/rome-ja.publishing-package.json");
  await writeFile(publishingPath, `${JSON.stringify({ ...result, verified }, null, 2)}\n`);
  return publishingPath;
};

export const runPilotCommand = async (arguments_: string[]): Promise<string> => {
  const parsed = parsePilotArguments(arguments_);
  if (parsed.credentialed) return runCredentialedPilot();

  const result = await runPilot(pilots[parsed.pilot]());
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
