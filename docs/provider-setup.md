# Provider Setup

Set `OPENAI_API_KEY`, `OPENAI_RESEARCH_MODEL`, `OPENAI_EDITORIAL_MODEL`, and `OPENAI_IMAGE_MODEL` for research/editorial/image adapters. Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` for narration. Keep `.env` local; it is ignored by Git.

Tests and deterministic pilot fixtures use fake providers and do not read these values. A credentialed production run must use project-specific model and prompt-template versions so provider provenance persists with every derived artifact.
