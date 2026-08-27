# Second Act Stories — Project Handoff

_Last updated: 2026-08-27_

This file is the working handoff for the **Second Act Stories** YouTube production system. New chats/agents should read this first and continue from the current state instead of redesigning the project from scratch.

## 1. Channel direction

**Channel:** Second Act Stories  
**Audience:** Americans 55+  
**Format:** long-form narrated stories with cinematic/documentary B-roll  
**Core promise:** major turning points after 55 — gray divorce, job loss / involuntary retirement, living alone, boundaries with adult children, regrets, rebuilding, and second chances.

Initial content mix:

- ~40% gray divorce + rebuilding finances
- ~35% job loss / retirement reset
- ~25% regrets / boundaries / living alone

Editorial framing should feel American: independence, autonomy, money/property, retirement savings, wills/trusts, boundaries, legal consequences, rebuilding, and believable second chances.

Avoid generic family-revenge melodrama, billionaire twists, and filial-duty framing that feels culturally mismatched for the US audience.

## 2. Current pilot

Primary pilot theme: **Gray Divorce + Retirement Reset**.

Example pilot concept:

> A 63-year-old woman divorces after 35 years and has to rebuild her retirement plan from scratch.

Example title direction:

> At 63, My Husband Asked for a Divorce. The Pension Statement Changed Everything

## 3. Repository / branch / PR

Repository:

`nguyenvancuong1ty/story-video`

Active branch:

`feat/second-act-openmontage`

Draft PR:

`#1 feat: dense multi-shot Second Act Stories pilot with OpenMontage`

Latest known CI status before this handoff: **passing** — tests, lint, and typecheck succeeded.

Do not merge the PR until a real local render succeeds and the user explicitly approves merging.

## 4. Current architecture

```text
ChatGPT
  ↓
Google Sheet — editorial source of truth / queue
  ↓
Local Windows worker — planned, not implemented yet
  ↓
CapCut TTS
  ↓
OpenMontage stock retrieval
  ↓
license/reuse filtering + edit planning
  ↓
Remotion 1920x1080 @ 30fps
  ↓
MP4
  ↓
Google Drive archive
```

Intended role split:

- **ChatGPT:** writer, editor, story reviewer, later QC reviewer
- **Google Sheet:** source of truth / editorial database / render queue
- **Local PC:** TTS, retrieval, render, technical QC
- **Google Drive 5TB:** storage/archive/curated footage

## 5. Google Sheet

Created Google Sheet:

**Second Act Content Factory**

URL:

`https://docs.google.com/spreadsheets/d/1WN099M7PEnJlS5D_mOfLJ27NnaG93pgNhrqOXjRKFZw/edit`

Tabs already created:

- `CONTENT_QUEUE`
- `STYLE_BIBLE`
- `USED_STORIES`
- `SCRIPT_REVIEW`

`CONTENT_QUEUE` already contains a first sample row `SA-001` for the gray-divorce pilot.

Important workflow decision: **the user should not need to manually fill the Sheet.** Brainstorm in ChatGPT; when the user says **“chốt”**, ChatGPT writes/updates the corresponding row.

Proposed status flow:

```text
BRAINSTORMING
→ APPROVED_FOR_SCRIPT
→ READY_TO_RENDER
→ RENDERING
→ UPLOADING
→ DONE
```

## 6. Existing story generator

File:

`packages/editorial/src/second-act.ts`

Current story schema includes:

- title
- description
- audiencePromise
- fictionDisclosure
- 14–18 beats for the pilot format

Each beat contains:

- narration
- subtitle
- visual tone
- optional chapter label
- optional key phrase
- 3–5 visual queries

Visual treatments:

- slow push in
- slow pull out
- pan left
- pan right
- locked
- slight slow motion

Prompt guidance already enforces:

- natural US English
- audience 55+
- believable details
- no billionaire/revenge melodrama
- no personalized legal / financial / medical advice
- fictionalized entertainment

Current generator is still a **short pilot architecture**. It does **not** yet properly support 1-hour scripts.

## 7. Existing OpenMontage integration

OpenMontage is used as a sibling checkout, not vendored into this repository.

Expected local layout:

```text
workspace/
├─ story-video/
└─ OpenMontage/
```

Bridge script:

`scripts/openmontage-retrieve.py`

It calls OpenMontage `DirectClipSearch` and writes retrieval metadata/provenance.

Current stock default:

`SECOND_ACT_STOCK_SOURCES=pexels`

Current safe mode:

`SECOND_ACT_LICENSE_MODE=safe`

The license filter is a **risk-reduction allowlist, not a legal guarantee**.

Pexels is preferred initially because licensing is more straightforward for commercial reuse. Wikimedia / NASA / Archive require more careful item-level review.

## 8. Current dense-edit implementation

Key files:

- `scripts/run-second-act.ts`
- `packages/rendering/src/second-act-plan.ts`
- `apps/remotion/src/SecondActComposition.tsx`
- `scripts/verify-render.ts`

Current pipeline does all of the following:

- generate story
- synthesize TTS per beat
- probe actual audio durations
- generate 3–5 visual search slots per beat
- retrieve footage through OpenMontage
- select eligible clips
- prefer unused clips
- adapt shot count to TTS duration
- plan shot timings
- deterministic motion treatments
- short crossfades
- muted source audio
- tone grading
- chapter cards
- key-phrase overlays
- optional music / ambience beds
- Remotion render
- output verification
- provenance package

Current render composition:

- 1920×1080
- 30 fps

## 9. Current output artifacts

A run produces items such as:

```text
story.json
visual-spec.json
edit-plan.json
footage-provenance.json
remotion-props.json
publishing-package.json
<story-slug>.mp4
```

Expected video path pattern:

`out/second-act/<story-slug>/<story-slug>.mp4`

## 10. Local setup

The repo is a **pnpm workspace**. Do not use `npm install`.

Recommended versions:

- Node 22
- pnpm 9.15.0

Setup:

```powershell
cd story-video
git fetch origin
git switch feat/second-act-openmontage
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Clone OpenMontage as sibling:

```powershell
cd ..
git clone https://github.com/calesthio/OpenMontage.git
```

Then configure `.env`, local LLM, CapCut TTS, OpenMontage Python, Pexels API key, and FFmpeg.

Pilot command:

```powershell
pnpm second-act:pilot -- --topic "A 63-year-old woman rebuilds her life after gray divorce and discovers her retirement plan was built around the marriage" --minutes 4 --license-mode safe
```

A real local pilot has **not yet been run successfully through the whole stack**. GitHub CI passes, but local dependencies/credentials must still be validated on the user’s Windows machine.

## 11. Pexels quota / stock strategy

Current Pexels free API limits discussed:

- 200 requests/hour
- 20,000 requests/month

The current short-pilot implementation can be query-heavy if every visual slot triggers a fresh search.

Before scaling to 1-hour videos, implement:

- query normalization / canonical categories
- batched retrieval
- metadata search cache
- local curated footage library
- dedupe across one episode
- reuse cooldown across nearby episodes
- API request budget per episode

Important design decision:

**Do not build a gigantic permanent local raw-video cache.**

Use three storage tiers:

```text
1. metadata + thumbnails      → keep long term
2. temporary selected clips  → local working cache
3. curated evergreen clips   → keep longer / archive to Drive
```

Google Drive 5TB should be used as archive/cold storage; local SSD should remain the working cache/render disk.

Do not make Remotion depend on streaming hundreds of source clips directly from Drive during rendering.

## 12. One-hour scaling — not implemented yet

Target production goal discussed:

**2 videos/day, about 1 hour each.**

Do not simply change `--minutes` to 60 and ask the LLM for one giant JSON story.

Recommended long-form architecture:

```text
long-form outline
→ 8–12 chapters
→ chapter-by-chapter script generation
→ TTS per section
→ measured timing
→ dense shot schedule
→ stock-bank selection
→ final render
```

A one-hour narration is roughly thousands of words, so chunking is required for reliability and quality.

## 13. Next major implementation: local worker

This is the **next task**.

Goal:

```text
ChatGPT writes approved script to Sheet
→ Sheet row becomes READY_TO_RENDER
→ local worker detects it
→ worker marks RENDERING
→ runs production pipeline
→ uploads output to Google Drive
→ marks UPLOADING / DONE
→ writes video URL/path back to Sheet
```

Planned commands:

```text
pnpm second-act:auth
pnpm second-act:worker
pnpm second-act:worker -- --once
```

`second-act:auth` should perform one-time Google OAuth on the local Windows machine.

The ChatGPT Google connection does **not** transfer credentials to the local PC, so the local worker needs its own Google OAuth credentials/token.

Recommended worker behavior:

- poll Sheet on a reasonable interval
- lock/claim one job safely
- avoid double rendering
- update status atomically where possible
- persist logs/job state locally
- recover from interruption/reboot
- support `--once` for safe testing
- upload final MP4 + provenance + QC reports to Drive
- write final Drive URL back to Sheet

Later, use Windows Task Scheduler so the worker starts automatically when the PC boots.

## 14. QC direction

After render, generate a review package in addition to the final MP4:

```text
final.mp4
review-proxy.mp4
transcript.json
edit-plan.json
qc-report.json
contact-sheet.jpg
provenance.json
```

Local worker should handle **technical QC**:

- expected resolution/fps
- missing audio
- long silence
- black frames
- subtitle overflow where detectable
- missing/corrupt clips
- excessive exact clip repetition
- provenance presence

ChatGPT can then handle **editorial QC** together with the user:

- hook strength
- pacing
- B-roll relevance
- repetition / monotony
- emotional logic
- title/script/video consistency
- mass-produced / repetitive feel

The user remains final approver.

## 15. YouTube monetization guardrails

The content must not feel mass-produced or minimally transformed.

Keep:

- original story/script
- original narration/TTS treatment
- substantive editing
- multiple contextual shots
- typography / chapter cards
- meaningful pacing and structure
- source provenance

Stock footage is B-roll, not the content itself.

Do not rely on superficial transformations such as mirror/crop tricks.

## 16. Immediate continuation instructions

When continuing this project:

1. Read this `HANDOFF.md` first.
2. Inspect the current branch before making changes.
3. Continue from the existing architecture; do not rebuild the pipeline from scratch.
4. Implement the **Google Sheet → local worker → Drive** bridge next unless the user changes priority.
5. Keep the PR draft until a real local end-to-end render succeeds.
6. Do not merge without explicit user approval.

## 17. User workflow goal

The desired final experience is:

```text
User discusses an idea with ChatGPT
→ user says “chốt”
→ ChatGPT stores the approved editorial package in the Sheet
→ local PC worker renders automatically
→ output appears on Google Drive
→ ChatGPT + user review the result
→ approve / revise
```

The user should not have to manually copy topics/scripts into Sheets or manually run a render command for every episode once the worker is operational.

## 18. Local worker implementation update — 2026-08-27

The first Google Sheet → local worker → Google Drive implementation now exists on `feat/second-act-openmontage`.

Added commands:

```text
pnpm second-act:auth
pnpm second-act:worker
pnpm second-act:worker -- --once
```

Worker behavior implemented:

- reads `CONTENT_QUEUE` by header name
- claims the first `READY_TO_RENDER` row
- writes `RENDERING` / `UPLOADING` / `DONE`
- runs the existing `second-act:pilot` pipeline rather than rebuilding rendering
- uploads final MP4 plus run JSON artifacts to Google Drive
- writes local video path and Drive URL back to the Sheet
- writes `RENDER_FAILED` plus an error note on failure
- supports continuous polling and safe `--once` mode

Google OAuth uses Node 22 built-in `fetch`; no `googleapis` dependency was added.
OAuth tokens are stored under ignored `.second-act/` local state.

Verification after implementation:

- worker helper unit tests pass
- standalone worker/auth TypeScript compile passes
- full workspace `typecheck` passes
- full workspace `test` passes
- full workspace `lint` passes

Local machine blockers still to configure before the first real worker run:

- Google OAuth desktop client ID + secret
- one-time `pnpm second-act:auth`
- Pexels API key
- local LLM service on port 20128
- CapCut TTS service on port 8765

The local `.env` has been created and already points to `C:\App\OpenMontage` and its `.venv` Python. Do not commit `.env` or `.second-act/` tokens.
