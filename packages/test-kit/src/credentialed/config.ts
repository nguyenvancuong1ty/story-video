type CredentialedBaseConfig = {
  capcutTtsBaseUrl: string;
  capcutTtsVoiceIndex: number;
  capcutTtsRate: string;
};

type LlmConfig =
  | { llmProvider: "local"; llmModel: string; localLlmBaseUrl: string }
  | { llmProvider: "openrouter"; llmModel: string; openRouterApiKey: string; openRouterLlmBaseUrl: string };

type ImageConfig =
  | { imageProvider: "local"; imageModel: string; localImageBaseUrl: string }
  | { imageProvider: "openrouter"; imageModel: string; openRouterApiKey: string; openRouterImageBaseUrl: string; openRouterImageTransport: "fetch" | "curl" };

export type CredentialedConfig = CredentialedBaseConfig & LlmConfig & ImageConfig;

type Environment = Readonly<Record<string, string | undefined>>;
type Fetcher = (input: string) => Promise<Response>;

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const loadCredentialedConfig = (environment: Environment): CredentialedConfig => {
  const required = (name: "LOCAL_LLM_MODEL" | "LOCAL_IMAGE_MODEL" | "OPENROUTER_API_KEY" | "OPENROUTER_LLM_MODEL" | "OPENROUTER_IMAGE_MODEL"): string => {
    const value = environment[name]?.trim();
    if (!value) throw new Error(`${name} is required for --credentialed`);
    return value;
  };
  const capcutTtsVoiceIndex = Number(environment.CAPCUT_TTS_VOICE_INDEX ?? "0");
  if (!Number.isInteger(capcutTtsVoiceIndex) || capcutTtsVoiceIndex < 0) throw new Error("CAPCUT_TTS_VOICE_INDEX must be a non-negative integer");

  const base: CredentialedBaseConfig = {
    capcutTtsBaseUrl: trimTrailingSlash(environment.CAPCUT_TTS_BASE_URL ?? "http://127.0.0.1:8765"),
    capcutTtsVoiceIndex,
    capcutTtsRate: environment.CAPCUT_TTS_RATE ?? "1.0"
  };
  const llmProvider = environment.LLM_PROVIDER ?? "local";
  const llmConfig: LlmConfig = llmProvider === "local"
    ? {
      llmProvider,
      llmModel: environment.LOCAL_LLM_MODEL?.trim() || "cx/gpt-5.6-terra",
      localLlmBaseUrl: trimTrailingSlash(environment.LOCAL_LLM_BASE_URL ?? "http://localhost:20128/v1")
    }
    : llmProvider === "openrouter"
      ? {
        llmProvider,
        llmModel: required("OPENROUTER_LLM_MODEL"),
        openRouterApiKey: required("OPENROUTER_API_KEY"),
        openRouterLlmBaseUrl: trimTrailingSlash(environment.OPENROUTER_LLM_BASE_URL ?? "https://openrouter.ai/api/v1")
      }
      : (() => { throw new Error("LLM_PROVIDER must be local or openrouter"); })();
  const imageProvider = environment.IMAGE_PROVIDER ?? "local";
  if (imageProvider === "local") {
    return {
      ...base,
      ...llmConfig,
      imageProvider,
      imageModel: required("LOCAL_IMAGE_MODEL"),
      localImageBaseUrl: trimTrailingSlash(environment.LOCAL_IMAGE_BASE_URL ?? "http://localhost:20128/v1")
    };
  }
  if (imageProvider === "openrouter") {
    const openRouterImageTransport = environment.OPENROUTER_IMAGE_TRANSPORT ?? "curl";
    if (openRouterImageTransport !== "fetch" && openRouterImageTransport !== "curl") throw new Error("OPENROUTER_IMAGE_TRANSPORT must be fetch or curl");
    return {
      ...base,
      ...llmConfig,
      imageProvider,
      imageModel: required("OPENROUTER_IMAGE_MODEL"),
      openRouterApiKey: required("OPENROUTER_API_KEY"),
      openRouterImageBaseUrl: trimTrailingSlash(environment.OPENROUTER_IMAGE_BASE_URL ?? "https://openrouter.ai/api/v1"),
      openRouterImageTransport
    };
  }
  throw new Error("IMAGE_PROVIDER must be local or openrouter");
};

const requireAvailable = async (fetcher: Fetcher, url: string, provider: string): Promise<void> => {
  let response: Response;
  try {
    response = await fetcher(url);
  } catch {
    throw new Error(`${provider} is unavailable at ${url.replace(/\/(models|api\/voices)$/, "")}`);
  }
  if (!response.ok) throw new Error(`${provider} is unavailable at ${url.replace(/\/(models|api\/voices)$/, "")}`);
};

export const assertCredentialedPreflight = async (config: CredentialedConfig, fetcher: Fetcher = fetch): Promise<void> => {
  if (config.llmProvider === "local") await requireAvailable(fetcher, `${config.localLlmBaseUrl}/models`, "Local LLM");
  await requireAvailable(fetcher, `${config.capcutTtsBaseUrl}/api/voices`, "CapCut TTS");
};
