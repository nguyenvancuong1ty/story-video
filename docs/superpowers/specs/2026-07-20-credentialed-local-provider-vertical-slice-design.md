# Credentialed Local-Provider Vertical Slice Design

## Goal

Prove the knowledge-story pipeline end to end with one real `rome-ja` run: local LLM text generation, OpenRouter image generation, CapCut narration, a vertical MP4, technical QA, and a source-traceable publishing package. The initial run prioritizes repeatable execution over media quality.

## Scope

- Use the OpenAI-compatible local LLM at `http://localhost:20128/v1` with model `cx/gpt-5.6-terra` for all structured research and editorial calls.
- Use OpenRouter's dedicated Image API for real generated raster assets. The model and key remain environment-owned.
- Limit a project to ten newly generated images. Exact cache hits do not consume the limit.
- Use the existing local CapCut web TTS service through `POST /api/tts/raw`, which returns MP3 bytes directly. The default Japanese voice is `voice_index=25` (`ICL_ja_female_zhiyu`).
- Add a credentialed `run-pilot` path that creates `out/rome-ja.mp4` and its publishing package, then checks final media with `verify-render`.
- Preserve the existing offline fixture pilots and fake-provider unit tests.

## Non-goals

- No provider-settings UI, authentication, or secret persistence.
- No quality tuning, image-to-image references, or more than ten generated images for this acceptance run.
- No full migration of API workflow state to PostgreSQL/BullMQ in this vertical slice. The command runner is the real-provider acceptance path; it must leave inspectable artifacts and report clear failures.

## Runtime Configuration

The runner loads configuration from the process environment. Secrets are never emitted in logs or artifacts.

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOCAL_LLM_BASE_URL` | `http://localhost:20128/v1` | OpenAI-compatible local API base URL |
| `LOCAL_LLM_MODEL` | `cx/gpt-5.6-terra` | Structured research/editorial model |
| `OPENROUTER_API_KEY` | none | Required for image generation |
| `OPENROUTER_IMAGE_MODEL` | none | Required selected OpenRouter image model |
| `OPENROUTER_IMAGE_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter Image API base URL |
| `CAPCUT_TTS_BASE_URL` | `http://127.0.0.1:8765` | Local CapCut web TTS base URL |
| `CAPCUT_TTS_VOICE_INDEX` | `25` | Japanese CapCut voice selection |
| `CAPCUT_TTS_RATE` | `1.0` | CapCut speech rate |
| `MAX_GENERATED_IMAGES_PER_PROJECT` | `10` | Hard maximum for cache misses |

## Components and Data Flow

1. The credentialed runner validates all non-secret configuration and checks local provider reachability before creating remote work.
2. A local-LLM adapter submits structured prompts to `/chat/completions`, extracts the JSON response, validates it against the existing Zod schema, and records provider/model provenance on each derived artifact.
3. The runner plans the smallest viable Rome storyboard and submits one image per cache miss to `POST /images`. It requests `n: 1`, a 9:16 aspect ratio, PNG output, and transparent backgrounds only where the layer requires alpha. It decodes `b64_json` into immutable media artifacts.
4. A CapCut TTS adapter calls `/api/tts/raw` for each narration chunk, persists the returned MP3, and reports failures as a retryable narration-child failure. The CapCut server performs task polling internally.
5. Composition consumes only approved assets, narration, and subtitle timing. The runner renders a 1080x1920, 30 fps H.264 MP4, saves it below `out/`, and `verify-render` rejects an invalid video or missing audio stream.
6. The publishing package records source, prompt/style, provider/model, image-budget, audio, render, and QA provenance. It traces the final package to its source artifacts.

## Image Budget and Cache Rules

The project ledger records a cache key for every image job plus whether it caused a provider request. Before a request, the runner checks for a previously approved matching key. A match reuses that artifact and does not increment `generatedImageCount`. A miss increments the count only after confirming it is below ten; the eleventh miss fails before contacting OpenRouter. Each request creates exactly one image (`n:1`).

## Error Handling

- Missing configuration, a stopped CapCut service, local LLM failure, OpenRouter failure, malformed structured output, and render failure terminate the credentialed run with a precise remediation message.
- An image or narration failure is attributed to its child identifier. A rerun can reuse all approved cache entries and unaffected narration artifacts.
- A render cannot be published unless `verify-render` confirms a nonempty 1080x1920 30 fps video and audio stream.
- The runner does not log API keys, authorization headers, complete provider responses containing secrets, or raw environment values.

## Verification

- Unit tests cover local-LLM request/response parsing, OpenRouter request shape and base64 decoding, CapCut request shape, image-budget enforcement, cache-hit exemption, and credential preflight failures.
- The first live acceptance run uses `rome-ja --credentialed`; it produces `out/rome-ja.mp4` plus `out/rome-ja.publishing-package.json`.
- Acceptance asserts no more than ten OpenRouter image calls, at least one CapCut narration artifact, complete source lineage, and `verify-render` success.

## Spec Self-Review

- No placeholders: every provider, default, request boundary, image-budget rule, and acceptance output is explicit.
- The scope is intentionally a real-provider runner, not a premature rewrite of the durable API/worker architecture.
- The runner's media contract is consistent: OpenRouter returns raster bytes, CapCut returns MP3 bytes, and rendering consumes approved media before technical QA.
