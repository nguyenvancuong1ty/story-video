# Local Gemini image provider

## Goal

Generate a Vietnamese Rome paper-cutout test video through the local OpenAI-compatible gateway
instead of OpenRouter. The visual workflow follows the layered Remotion method: every shot is
assembled from independent background, character, and foreground assets rather than a single
animated poster.
The gateway endpoint is `http://localhost:20128/v1` and the approved image model is
`ag/gemini-3.1-flash-image`.

## Verified gateway contract

`POST /chat/completions` with the approved model, a text content part, and
`modalities: ["image", "text"]` returns HTTP 200. The generated JPEG is embedded in
`choices[0].message.content` as Markdown with a `data:image/jpeg;base64,...` URL.
The response can exceed 1 MiB.

## Scope

- Replace the OpenRouter-specific image request in the credentialed `rome-vi` runner with a
  local chat-image provider.
- Configure the local image endpoint and model independently from the local editorial LLM.
- Remove OpenRouter credentials and the enforced ten-image budget from the credentialed
  configuration and runner.
- Generate the localized script, captions, and CapCut narration in Vietnamese (`vi-VN`), using
  CapCut voice index `0` (`BV421_vivn_streaming`).
- Preserve the `cx/gpt-5.6-terra` editorial model, artifact lineage, rendering, and generated-media reuse.
- Replace the red primary-card and particle mock layers with real cutout assets and a scene asset
  manifest consumed by Remotion.
- Divide each narrative beat into a wide and detail shot. Each shot is composed from a background
  plate, independent paper-cutout figures, and optional foreground decorations.

## Design

### Provider

Create a local chat-image provider under `packages/assets`. It sends an OpenAI-compatible
chat completion request with `modalities: ["image", "text"]`, asks for one image, then extracts
the first data URL from Markdown in `message.content`. It decodes the base64 bytes and derives
the MIME type from the data URL. It reports response errors without including credentials or
base64 payloads.

### Configuration

Add `LOCAL_IMAGE_BASE_URL` (default `http://localhost:20128/v1`) and require
`LOCAL_IMAGE_MODEL`. The example environment sets the approved Gemini alias. Remove the
OpenRouter API key/model/base URL and image transport settings from the credentialed contract.

### Runner

The `rome-vi` runner records the local image model in each asset artifact. It asks the local
editorial model for factual Vietnamese narration, then writes Vietnamese subtitles and narration
clips. Image prompts remain English so the image model receives explicit visual art direction.
No artificial image-count cap is applied.

### Shot and asset contract

The runner creates five Vietnamese beats, each with a six-second wide shot and a six-second
detail shot. The two shots reuse their beat's five source layers but change camera and timing.
Each shot has an explicit manifest:

- `background`: a 9:16 environment plate with paper texture and no main characters.
- `primary`: a full-body hero cutout on a chroma-green background, later converted to alpha PNG.
- `secondary` and `tertiary`: supporting character cutouts, also converted to alpha PNG.
- `foreground`: optional decorative torn-paper, tape, or stamp cutouts.

For each asset, the manifest stores the source path, role, normalized x/y position, width,
z-index, entry delay, and entrance direction. Generated character assets must request complete
uncropped figures, clear silhouette, white paper outline, no text, no shadow, and a chroma-green
background. A local image-processing step removes the chroma background and writes a PNG with an
alpha channel.

### Remotion composition

Remotion renders the manifest in this order: background, tertiary, secondary, primary,
foreground, subtitle. It performs a static layout pass through the same component before motion.
Role-specific entrance motions are staggered: the primary enters first with the greatest travel,
secondary layers follow, and tertiary layers move least. The background receives only a subtle
camera move. All mock red cards and procedural black dots are removed.

Each beat is allocated twelve seconds as two six-second shots, matching the controlled 25--35-word
narration target. Captions remain Vietnamese and are positioned below the scene's ground line. A
lightweight visual preview render is verified before the full 60-second export.

## Error handling and verification

- Provider tests cover the request body, Markdown data-URL decoding, and safe upstream errors.
- Configuration tests cover defaults and missing local image configuration.
- Image-processing tests cover chroma-green removal and alpha-channel validation.
- Credentialed runner tests verify `rome-vi` narration is Vietnamese and creates a layered shot
  manifest with every required role.
- Remotion tests verify real asset paths are rendered for each layer and the mock-card rendering
  path is absent.
- A live smoke call confirms `ag/gemini-3.1-flash-image` returns an image through the local
  endpoint, followed by a preview render, a full credentialed Rome render, and `ffprobe` verification.

## Non-goals

- No OpenRouter fallback.
- No change to CapCut TTS.
- No image-to-video provider; all motion remains deterministic Remotion animation.
