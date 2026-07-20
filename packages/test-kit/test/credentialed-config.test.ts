import { expect, it } from "vitest";

import { assertCredentialedPreflight, loadCredentialedConfig } from "../src/credentialed/config.js";

const requiredEnvironment = { LOCAL_IMAGE_MODEL: "ag/gemini-3.1-flash-image" };

it("uses the approved local-provider defaults", () => {
  expect(loadCredentialedConfig(requiredEnvironment)).toMatchObject({
    localLlmBaseUrl: "http://localhost:20128/v1",
    localLlmModel: "cx/gpt-5.6-terra",
    localImageBaseUrl: "http://localhost:20128/v1",
    localImageModel: "ag/gemini-3.1-flash-image",
    capcutTtsBaseUrl: "http://127.0.0.1:8765",
    capcutTtsVoiceIndex: 0
  });
});

it("reports missing image configuration without exposing a value", () => {
  expect(() => loadCredentialedConfig({})).toThrow("LOCAL_IMAGE_MODEL is required");
});

it("checks local LLM and CapCut before a credentialed run", async () => {
  const requests: string[] = [];
  await expect(
    assertCredentialedPreflight(loadCredentialedConfig(requiredEnvironment), async (input) => {
      requests.push(String(input));
      return new Response("[]", { status: 200 });
    })
  ).resolves.toBeUndefined();

  expect(requests).toEqual(["http://localhost:20128/v1/models", "http://127.0.0.1:8765/api/voices"]);
});

it("names an unavailable local provider without starting remote work", async () => {
  await expect(
    assertCredentialedPreflight(loadCredentialedConfig(requiredEnvironment), async () => new Response("unavailable", { status: 503 }))
  ).rejects.toThrow("Local LLM is unavailable at http://localhost:20128/v1");
});
