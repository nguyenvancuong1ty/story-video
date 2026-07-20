import { expect, it, vi } from "vitest";

import { parsePilotArguments, runPilotCommand } from "./run-pilot.js";

it("requires rome-vi for the credentialed vertical slice", () => {
  expect(parsePilotArguments(["--pilot", "rome-vi", "--credentialed"])).toEqual({ pilot: "rome-vi", credentialed: true });
  expect(() => parsePilotArguments(["--pilot", "pompeii-ja", "--credentialed"])).toThrow("--credentialed currently supports rome-vi only");
});

it("keeps offline pilots available without the credentialed flag", () => {
  expect(parsePilotArguments(["--pilot", "pyramids-ja"])).toEqual({ pilot: "pyramids-ja", credentialed: false });
});

it("checks credential configuration after safely checking for an optional .env file", async () => {
  vi.stubEnv("LOCAL_IMAGE_MODEL", "");
  await expect(runPilotCommand(["--pilot", "rome-vi", "--credentialed"])).rejects.toThrow("LOCAL_IMAGE_MODEL is required");
  vi.unstubAllEnvs();
});
