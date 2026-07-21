import { expect, it } from "vitest";

import { assertCredentialedPreflight, loadCredentialedConfig } from "../src/credentialed/config.js";

const requiredEnvironment = { LOCAL_IMAGE_MODEL: "ag/gemini-3.1-flash-image" };

it("uses the local image provider by default", () => {
  expect(loadCredentialedConfig(requiredEnvironment)).toMatchObject({
    localLlmBaseUrl: "http://localhost:20128/v1",
    llmProvider: "local",
    llmModel: "cx/gpt-5.6-terra",
    imageProvider: "local",
    imageModel: "ag/gemini-3.1-flash-image",
    localImageBaseUrl: "http://localhost:20128/v1",
    capcutTtsBaseUrl: "http://127.0.0.1:8765",
    capcutTtsVoiceIndex: 0
  });
});

it("uses OpenRouter for the LLM only when selected and configured", () => {
  expect(loadCredentialedConfig({
    LOCAL_IMAGE_MODEL: "local-image",
    LLM_PROVIDER: "openrouter",
    OPENROUTER_API_KEY: "secret",
    OPENROUTER_LLM_MODEL: "openrouter/llm"
  })).toMatchObject({
    llmProvider: "openrouter",
    llmModel: "openrouter/llm",
    openRouterLlmBaseUrl: "https://openrouter.ai/api/v1"
  });
});

it("uses OpenRouter only when selected and configured", () => {
  expect(loadCredentialedConfig({
    IMAGE_PROVIDER: "openrouter",
    OPENROUTER_API_KEY: "secret",
    OPENROUTER_IMAGE_MODEL: "google/gemini-image"
  })).toMatchObject({
    imageProvider: "openrouter",
    imageModel: "google/gemini-image",
    openRouterImageBaseUrl: "https://openrouter.ai/api/v1",
    openRouterImageTransport: "curl"
  });
});

it("reports missing image configuration without exposing a value", () => {
  expect(() => loadCredentialedConfig({})).toThrow("LOCAL_IMAGE_MODEL is required");
  expect(() => loadCredentialedConfig({ IMAGE_PROVIDER: "openrouter", OPENROUTER_IMAGE_MODEL: "model" })).toThrow("OPENROUTER_API_KEY is required");
  expect(() => loadCredentialedConfig({ IMAGE_PROVIDER: "other" })).toThrow("IMAGE_PROVIDER must be local or openrouter");
  expect(() => loadCredentialedConfig({ LOCAL_IMAGE_MODEL: "model", LLM_PROVIDER: "openrouter" })).toThrow("OPENROUTER_LLM_MODEL is required");
  expect(() => loadCredentialedConfig({ LOCAL_IMAGE_MODEL: "model", LLM_PROVIDER: "other" })).toThrow("LLM_PROVIDER must be local or openrouter");
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

it("does not preflight a remote LLM", async () => {
  const requests: string[] = [];
  await assertCredentialedPreflight(loadCredentialedConfig({
    LOCAL_IMAGE_MODEL: "local-image",
    LLM_PROVIDER: "openrouter",
    OPENROUTER_API_KEY: "secret",
    OPENROUTER_LLM_MODEL: "remote-llm"
  }), async (input) => {
    requests.push(String(input));
    return new Response("[]", { status: 200 });
  });
  expect(requests).toEqual(["http://127.0.0.1:8765/api/voices"]);
});
