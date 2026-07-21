# Provider Setup

Set `OPENAI_API_KEY`, `OPENAI_RESEARCH_MODEL`, `OPENAI_EDITORIAL_MODEL`, and `OPENAI_IMAGE_MODEL` for research/editorial/image adapters. Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` for narration. Keep `.env` local; it is ignored by Git.

Tests and deterministic pilot fixtures use fake providers and do not read these values. A credentialed production run must use project-specific model and prompt-template versions so provider provenance persists with every derived artifact.

## Credentialed Rome acceptance

The credentialed Rome vertical slice selects its LLM and image provider independently in the ignored `.env` file. Both default to the local OpenAI-compatible endpoint.

Use the local LLM (the default):

```dotenv
LLM_PROVIDER=local
LOCAL_LLM_BASE_URL=http://localhost:20128/v1
LOCAL_LLM_MODEL=cx/gpt-5.6-terra
```

Or use OpenRouter for the LLM:

```dotenv
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_LLM_MODEL=...
OPENROUTER_LLM_BASE_URL=https://openrouter.ai/api/v1
```

Use the local image endpoint (the default):

```dotenv
IMAGE_PROVIDER=local
LOCAL_IMAGE_BASE_URL=http://localhost:20128/v1
LOCAL_IMAGE_MODEL=ag/gemini-3.1-flash-image
```

Or use OpenRouter for images:

```dotenv
IMAGE_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_IMAGE_MODEL=...
OPENROUTER_IMAGE_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_IMAGE_TRANSPORT=curl
```

`OPENROUTER_IMAGE_TRANSPORT` can be `curl` (the default, suitable for large image responses) or `fetch`. The same `OPENROUTER_API_KEY` is used for either OpenRouter provider.

CapCut narration is read from `CAPCUT_TTS_BASE_URL`, defaulting to `http://127.0.0.1:8765`; its default voice index is `CAPCUT_TTS_VOICE_INDEX=0`. Start the service from the existing project before the run:

```bash
cd /home/cuongdev/Documents/voice_video
python3 web_tts.py
```

The selected image provider and model are persisted in each generated image artifact.
