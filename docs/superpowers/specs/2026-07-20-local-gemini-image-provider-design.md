# Local Gemini image provider

## Goal

Generate Rome visual assets through the local OpenAI-compatible gateway instead of OpenRouter.
The gateway endpoint is `http://localhost:20128/v1` and the approved image model is
`ag/gemini-3.1-flash-image`.

## Verified gateway contract

`POST /chat/completions` with the approved model, a text content part, and
`modalities: ["image", "text"]` returns HTTP 200. The generated JPEG is embedded in
`choices[0].message.content` as Markdown with a `data:image/jpeg;base64,...` URL.
The response can exceed 1 MiB.

## Scope

- Replace the OpenRouter-specific image request in the credentialed Rome runner with a
  local chat-image provider.
- Configure the local image endpoint and model independently from the local editorial LLM.
- Remove OpenRouter credentials and the enforced ten-image budget from the credentialed
  configuration and runner.
- Preserve CapCut TTS, the `cx/gpt-5.6-terra` editorial model, artifact lineage, rendering,
  and generated-media reuse.

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

The Rome runner records the local image model in each asset artifact. It makes one image request
per missing scene asset and reuses existing assets on reruns. No artificial image-count cap is
applied. The visual beat/shot redesign from `vox-director` is deliberately a follow-up: this
change establishes the local unlimited image backend first.

## Error handling and verification

- Provider tests cover the request body, Markdown data-URL decoding, and safe upstream errors.
- Configuration tests cover defaults and missing local image configuration.
- Credentialed runner tests verify existing image assets are reused.
- A live smoke call confirms `ag/gemini-3.1-flash-image` returns an image through the local
  endpoint, followed by a credentialed Rome render and `ffprobe` verification.

## Non-goals

- No OpenRouter fallback.
- No change to CapCut TTS.
- No motion/poster redesign in this change.
