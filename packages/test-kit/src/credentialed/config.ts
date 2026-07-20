export type CredentialedConfig = {
  localLlmBaseUrl: string;
  localLlmModel: string;
  openRouterApiKey: string;
  openRouterImageBaseUrl: string;
  openRouterImageModel: string;
  openRouterImageTransport: "fetch" | "curl";
  capcutTtsBaseUrl: string;
  capcutTtsVoiceIndex: number;
  capcutTtsRate: string;
  maxGeneratedImages: number;
};

type Environment = Readonly<Record<string, string | undefined>>;
type Fetcher = (input: string) => Promise<Response>;

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const loadCredentialedConfig = (environment: Environment): CredentialedConfig => {
  const required = (name: "OPENROUTER_API_KEY" | "OPENROUTER_IMAGE_MODEL"): string => {
    const value = environment[name]?.trim();
    if (!value) throw new Error(`${name} is required for --credentialed`);
    return value;
  };
  const maxGeneratedImages = Number(environment.MAX_GENERATED_IMAGES_PER_PROJECT ?? "10");
  if (!Number.isInteger(maxGeneratedImages) || maxGeneratedImages < 1 || maxGeneratedImages > 10) {
    throw new Error("MAX_GENERATED_IMAGES_PER_PROJECT must be an integer from 1 to 10");
  }

  const capcutTtsVoiceIndex = Number(environment.CAPCUT_TTS_VOICE_INDEX ?? "25");
  if (!Number.isInteger(capcutTtsVoiceIndex) || capcutTtsVoiceIndex < 0) throw new Error("CAPCUT_TTS_VOICE_INDEX must be a non-negative integer");

  const openRouterImageTransport = environment.OPENROUTER_IMAGE_TRANSPORT ?? "curl";
  if (openRouterImageTransport !== "fetch" && openRouterImageTransport !== "curl") {
    throw new Error("OPENROUTER_IMAGE_TRANSPORT must be fetch or curl");
  }

  return {
    localLlmBaseUrl: trimTrailingSlash(environment.LOCAL_LLM_BASE_URL ?? "http://localhost:20128/v1"),
    localLlmModel: environment.LOCAL_LLM_MODEL ?? "cx/gpt-5.6-terra",
    openRouterApiKey: required("OPENROUTER_API_KEY"),
    openRouterImageBaseUrl: trimTrailingSlash(environment.OPENROUTER_IMAGE_BASE_URL ?? "https://openrouter.ai/api/v1"),
    openRouterImageModel: required("OPENROUTER_IMAGE_MODEL"),
    openRouterImageTransport,
    capcutTtsBaseUrl: trimTrailingSlash(environment.CAPCUT_TTS_BASE_URL ?? "http://127.0.0.1:8765"),
    capcutTtsVoiceIndex,
    capcutTtsRate: environment.CAPCUT_TTS_RATE ?? "1.0",
    maxGeneratedImages
  };
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
  await requireAvailable(fetcher, `${config.localLlmBaseUrl}/models`, "Local LLM");
  await requireAvailable(fetcher, `${config.capcutTtsBaseUrl}/api/voices`, "CapCut TTS");
};
