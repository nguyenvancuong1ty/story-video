import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createPompeiiJapanesePilot, createPyramidsJapanesePilot, createRomeJapanesePilot, runPilot } from "../packages/test-kit/src/pilots/index.js";

const pilots = {
  "rome-ja": createRomeJapanesePilot,
  "pompeii-ja": createPompeiiJapanesePilot,
  "pyramids-ja": createPyramidsJapanesePilot
} as const;

void (async () => {
  const selectedId = process.argv[process.argv.indexOf("--pilot") + 1] as keyof typeof pilots | undefined;
  if (!selectedId || !(selectedId in pilots)) throw new Error("Usage: run-pilot --pilot rome-ja|pompeii-ja|pyramids-ja");

  const result = await runPilot(pilots[selectedId]());
  const outputDirectory = resolve("out");
  const outputPath = resolve(outputDirectory, `${selectedId}.publishing-package.json`);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(outputPath);
})().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
