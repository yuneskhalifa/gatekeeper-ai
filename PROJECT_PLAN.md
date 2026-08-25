# Gatekeeper AI — The Ruthless Journalist Pitch Simulator

## Context

This is the take-home for the Pathos Communications role (`JOB_DESCRIPTION.md`). Pathos explicitly wants: a small, finished app for a PR company, built with AI, with commit history and a demo video showing spec thinking, how the AI was directed, and how the output was verified. They call out "professional skepticism toward AI output" as the thing they're grading for — which is exactly the pitch of this idea: an app whose entire premise is stress-testing AI-generated pitches against a skeptical AI gatekeeper before a human sends them.

The repo is already named `gatekeeper-ai`, which fits the product concept directly (an AI gatekeeper standing between the PR consultant and the journalist), so the plan adopts that as the product name.

The user also wants this build to deliberately exercise the specific Claude API course modules they just completed — system prompts, streaming, prompt evaluation / model-based grading, prompt engineering technique, tool use, RAG, Claude features (extended thinking, image/PDF support, citations, prompt caching), and agents/workflows (routing, parallelization, chaining) — so the video can speak to real, working use of each. Given "keep it small and finished, an evening or two," the plan is split into a lean, fully-working **Milestone 1 (MVP)** and clearly-scoped **stretch milestones** that layer in the rest of the course topics without putting the finished/demoable state at risk.

Decisions already made with the user:
- **RAG**: two lexical **BM25** indices (no external embeddings provider/API key needed) — a Journalist Corpus index and a PR Playbook index. Satisfies "text chunking," "BM25 lexical search," and "multi-index RAG pipeline" from the course without adding a Voyage AI dependency.
- **Scope**: Milestone 1 must be a complete, demoable app on its own. Everything past it is explicitly optional stretch, built only if time allows, but fully speced now so it's a straight shot to implement.

Stack: **TypeScript + Next.js (App Router)**, Anthropic TypeScript SDK, Tailwind for styling, no database (in-memory/session state only — this is a demo, not Pressella itself).

---

## Product Concept

**PR Consultant** pastes the client's news + a drafted pitch. Claude roleplays a specific, cynical journalist persona (e.g. a senior TechCrunch editor drowning in 500 pitches/day) and "reads" it live. On each turn the journalist-agent must pick one discrete action via tool use:

- `reject_pitch` — harsh, specific critique of why it doesn't work
- `request_data` — demands real metrics/evidence before considering it
- `ask_question` — a clarifying question (e.g. "why now?")
- `book_meeting` — accepts, proposes times

Every turn also emits a **Pitch Viability Score (0–100)** via structured output. The consultant edits the pitch and resubmits in the same thread until the journalist books the meeting (or gives up).

## Feature Map — Course Topic → Product Feature

| Course topic | Where it's used |
|---|---|
| System prompts (persona) | Deep journalist persona: outlet, beat, seniority, pet peeves, tone — drives every response |
| Prompt engineering (clear/direct, specific, XML tags, examples) | Persona prompt is XML-structured (`<persona>`, `<beat>`, `<pet_peeves>`, `<rules>`); few-shot examples of real rejections/acceptances included |
| Tool use | `reject_pitch`, `request_data`, `ask_question`, `book_meeting` — forced single discrete action per turn |
| Structured outputs | `score_pitch` tool call returns `{score, strengths[], weaknesses[], verdict}` — the Viability Score |
| Response streaming | Journalist's critique streams token-by-token in the transcript UI |
| Prompt caching | System prompt + persona + (later) RAG context marked `cache_control`; UI shows a "cache hit" badge with cached-token counts across the multi-turn thread |
| Prompt evaluation / model-based grading | Dev-only eval harness (`scripts/evals`): fixed test pitches run through the journalist agent, graded by a separate Claude "grader" call for persona-consistency and realism |
| Extended thinking | Journalist's private reasoning captured as "Editor's Private Notes," collapsible in the UI — meta and demoable |
| Image / PDF support | Consultant can attach a press kit PDF or product screenshot; journalist reacts to it directly |
| Citations | Once RAG is wired, the journalist's critique cites exact snippets from the Journalist Corpus / PR Playbook it's grounded on |
| RAG (chunking, BM25, multi-index) | Two BM25 indices — Journalist Corpus (grounds voice, enables citations) and PR Playbook (grounds "what makes pitches work" advice) |
| Agents & workflows — routing | Auto-classify the pitch (product launch / funding / exec move / etc.) and route to the best-fit journalist persona |
| Agents & workflows — parallelization | "Gauntlet Mode": same pitch sent to 3 personas concurrently, results aggregated side-by-side |
| Agents & workflows — chaining | "Coach Mode": critique → suggested rewrite → user edits → resubmit, as an explicit multi-step chain distinct from the interactive agent loop |
| Code execution / Files API | Stretch: "Export Session Report" — generates a shareable PDF/markdown recap of the pitch-refinement thread |

---

## Milestone 1 — MVP (must finish; the demoable app)

**Goal:** a working single-page simulator: pick a persona, paste client news + pitch, get a streamed, tool-driven journalist reaction with a live viability score, refine, repeat.

### Structure
```
app/
  page.tsx                    # simulator UI
  api/simulate/route.ts       # POST — streams journalist turn
lib/
  anthropic/
    client.ts                 # SDK client wrapper
    personas.ts                # persona system-prompt definitions (XML-structured, few-shot examples)
    tools.ts                   # tool schemas: reject_pitch, request_data, ask_question, book_meeting, score_pitch
components/
  Simulator.tsx                # composer + transcript container
  PitchComposer.tsx            # client news + pitch textarea, persona selector
  Transcript.tsx               # streamed message list
  ToolActionBadge.tsx          # REJECTED / DATA REQUESTED / MEETING BOOKED badge
  ScoreGauge.tsx                # 0–100 viability score
```

### Design System

No hand-rolled or third-party design system (no Material Design) — **shadcn/ui** on top of Tailwind:

- `npx shadcn init` scaffolds `components/ui/*` (button, badge, textarea, tabs, collapsible, avatar, etc.) built on Radix primitives, styled entirely with Tailwind utility classes, copied into the repo as owned source (not an npm dependency to import from).
- Consistency comes from a **single theme file**, not per-component styling: `app/globals.css` defines CSS variables (`--primary`, `--background`, `--foreground`, `--muted`, `--destructive`, `--border`, ...) for light and dark, and Tailwind config maps them to semantic classes (`bg-primary`, `text-muted-foreground`, `border-border`). Every shadcn component only ever references these tokens, never a raw hex or a one-off Tailwind color — so every button, badge, and border updates together from one place.
- Pick the palette once, first: dark, newsroom/editorial neutrals (ink/charcoal background, warm off-white text) with a single accent color doing double duty — used for `--primary` (book_meeting / accept states) and `--destructive` (reject states) via shadcn's existing variant system, rather than inventing new one-off colors per component.
- Do this as the first step of the Milestone 1 scaffold (before any feature UI), so every component built afterward inherits it automatically.

### Key implementation notes
- Use `anthropic.messages.stream()` from an API route (Node runtime, not edge — SDK streaming + tool use needs it). Stream text deltas to the client via a `ReadableStream` / SSE; parse tool-use blocks as they complete.
- Force exactly one action tool per turn (`tool_choice: {type: "any"}` restricted to the 4 action tools) plus always request `score_pitch` as a second, always-included tool so every turn returns a score regardless of which action fires.
- System prompt built with XML structure, e.g.:
  ```xml
  <persona>
    <name>...</name><outlet>...</outlet><beat>...</beat>
    <pet_peeves>...</pet_peeves>
    <rules>Always take exactly one action. Be specific and harsh but fair.</rules>
  </persona>
  <examples>...2-3 few-shot rejection/acceptance examples...</examples>
  ```
- Mark the system prompt block with `cache_control: {type: "ephemeral"}` from the start — this is free to add now and sets up the Milestone 2 caching demo.
- Conversation state kept client-side (React state) and replayed each turn — no DB needed for a single-session demo.

### Verification
- Run locally (`npm run dev`), manually test: a strong pitch → `book_meeting`; a vague pitch → `reject_pitch` or `request_data` with a real critique; confirm score updates every turn.
- Confirm streaming renders incrementally (not all-at-once) in the browser.
- Confirm the API route handles multi-turn: prior turns are replayed as message history, not just the latest.

---

## Milestone 2 — Claude Feature Depth (stretch, high value, low risk)

Layers onto Milestone 1 without changing its shape.

1. **Prompt caching, made visible**: read `cache_creation_input_tokens` / `cache_read_input_tokens` off each response, show a small badge ("💾 1,240 cached tokens — saved ~X ms") in the transcript. Directly demoable in the video.
2. **Extended thinking**: enable `thinking` on the persona call; render the thinking block behind a collapsible "🧠 Editor's Private Notes" toggle in `Transcript.tsx`. Good demo of a Claude feature that's otherwise invisible.
3. **Image / PDF support**: add an attachment control in `PitchComposer.tsx`; send as base64 image/PDF content blocks alongside the text. Journalist can react to a press kit or screenshot ("this UI screenshot doesn't back up your claim").

### Verification
- Confirm cache-read tokens appear on the *second and later* turns of a thread (first turn is always a cache write).
- Confirm thinking content is present and renders only when `thinking` is enabled.
- Upload a sample PDF and image; confirm the journalist's response references their content.

---

## Milestone 3 — RAG (stretch)

Two BM25 indices, both built from small local corpora checked into the repo (no external embedding calls, no extra API key).

```
data/
  journalists/*.md     # 1 file per persona: bio, beat, 3-5 sample past headlines/ledes, tone notes
  playbook/*.md         # PR best-practice docs: what makes a pitch land, embargo etiquette, common mistakes
lib/rag/
  chunk.ts               # simple chunking (by heading / fixed-size with overlap)
  bm25.ts                 # BM25 index + query (small hand-rolled or a lightweight JS BM25 lib)
  retrieve.ts             # multi-index retrieval: query both indices, merge top-k, tag by source
```

- On each turn: retrieve top-k chunks from **both** indices using the pitch + client news as the query, inject as a `<context>` block in the user turn (also `cache_control`-tagged where it repeats).
- Enable **citations** (`citations: {enabled: true}` on the injected document blocks) so the journalist's critique can quote the exact playbook line or past-article snippet it's using — surfaced in the UI as small footnote-style references.

### Verification
- Query the BM25 index directly (unit-level script) for a known pitch topic and confirm relevant journalist/playbook chunks rank highly.
- Confirm a critique response includes at least one citation back to a specific `data/` document during manual testing.

---

## Milestone 4 — Agents & Workflows (stretch)

Three additions, each mapping to a distinct course concept — call this out explicitly in the video, since the course draws a real line between "agent" and "workflow":

1. **Routing workflow** (`lib/agents/route.ts`): one small, cheap Claude call classifies the pitch category (launch / funding / exec move / crisis / other) and picks the best-fit persona automatically, offered as an "Auto-pick journalist" option next to the manual persona selector.
2. **Parallelization workflow — "Gauntlet Mode"** (`app/api/gauntlet/route.ts`): the same pitch is sent to 3 personas concurrently (`Promise.all`), results rendered side-by-side so the consultant sees how the pitch lands across outlets at once.
3. **Chaining workflow — "Coach Mode"**: after a rejection, an explicit deterministic chain — critique (already have it) → a second call proposes a concrete rewrite → consultant edits/accepts → resubmits to the same journalist. This is a fixed pipeline (workflow), contrasted with the main simulator loop which is the "agent" (autonomous, picks its own next action via tool use each turn).

### Verification
- Trigger Gauntlet Mode and confirm 3 independent, concurrent responses render without blocking on each other.
- Confirm routing picks a sensible persona for an obviously funding-related vs. obviously product-launch pitch.
- Walk the Coach Mode chain end-to-end once manually.

---

## Milestone 5 — Evals / Model-Graded Testing + Export (stretch, do last)

1. **Model-based grading harness** (`scripts/evals/run.ts`, run via `tsx`): a fixed set of ~5–8 test pitches (some strong, some weak, some borderline) run through the journalist agent; a separate Claude "grader" call scores each response against a rubric (persona consistency, realism, did-it-take-exactly-one-action, is-the-score-sane). Prints a pass/fail table — this is the dev-facing "professional skepticism toward AI" artifact worth showing in the video.
2. **Export Session Report** (stretch, only if time remains): uses the Files API / code execution to turn a finished thread into a shareable markdown or PDF recap.

### Verification
- `npm run evals` runs standalone (no UI needed) and prints a scored table for all fixed test pitches.
- Spot-check one eval grade manually against the actual transcript to confirm the grader's judgment is sane.

---

## Suggested Build Order & Commit Cadence

Matches the job's "trunk-based, small commits, main always releasable" ethos — treat each milestone as several small, working commits, not one giant one:
1. Scaffold Next.js + TS + Tailwind, empty simulator shell.
2. Persona + system prompt + single non-streaming tool-use call, hardcoded persona, one action tool.
3. Add `score_pitch`, remaining action tools, multi-turn history.
4. Streaming.
5. Prompt caching badge.
6. Extended thinking panel.
7. Image/PDF attachments.
8. RAG corpora + BM25 + retrieval + injection.
9. Citations.
10. Routing + Gauntlet + Coach Mode.
11. Eval harness.
12. README with setup, architecture diagram of the feature map above, and demo notes for the video.

Milestone 1 alone (steps 1–4, roughly) is a legitimate stopping point if time runs short — it is a complete, demoable product on its own.
