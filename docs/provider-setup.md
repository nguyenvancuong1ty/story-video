# Provider Setup

Set `OPENAI_API_KEY`, `OPENAI_RESEARCH_MODEL`, `OPENAI_EDITORIAL_MODEL`, and `OPENAI_IMAGE_MODEL` for research/editorial/image adapters. Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` for narration. Keep `.env` local; it is ignored by Git.

Tests and deterministic pilot fixtures use fake providers and do not read these values. A credentialed production run must use project-specific model and prompt-template versions so provider provenance persists with every derived artifact.

## Local-provider Rome acceptance

The credentialed Rome vertical slice uses the OpenAI-compatible local LLM at `http://localhost:20128/v1` with `LOCAL_LLM_MODEL=cx/gpt-5.6-terra`. It requires `OPENROUTER_API_KEY` and `OPENROUTER_IMAGE_MODEL` for the dedicated OpenRouter Image API. Keep both values only in the ignored `.env` file.

CapCut narration is read from `CAPCUT_TTS_BASE_URL`, defaulting to `http://127.0.0.1:8765`; its default Japanese voice is `CAPCUT_TTS_VOICE_INDEX=25`. Start the service from the existing project before the run:

```bash
cd /home/cuongdev/Documents/voice_video
python3 web_tts.py
```

The first credentialed Rome run creates six 9:16 PNG images. `MAX_GENERATED_IMAGES_PER_PROJECT` cannot exceed `10`; exact image-cache hits do not consume the limit.
