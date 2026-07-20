import { expect, it, vi } from "vitest";

import { parsePilotArguments, runPilotCommand } from "./run-pilot.js";

it("requires rome-ja for the credentialed vertical slice", () => {
  expect(parsePilotArguments(["--pilot", "rome-ja", "--credentialed"])).toEqual({ pilot: "rome-ja", credentialed: true });
  expect(() => parsePilotArguments(["--pilot", "pompeii-ja", "--credentialed"])).toThrow("--credentialed currently supports rome-ja only");
});

it("keeps offline pilots available without the credentialed flag", () => {
  expect(parsePilotArguments(["--pilot", "pyramids-ja"])).toEqual({ pilot: "pyramids-ja", credentialed: false });
});

it("checks credential configuration after safely checking for an optional .env file", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("OPENROUTER_IMAGE_MODEL", "");
  await expect(runPilotCommand(["--pilot", "rome-ja", "--credentialed"])).rejects.toThrow("OPENROUTER_API_KEY is required");
  vi.unstubAllEnvs();
});
