# Gatekeeper AI — The Ruthless Journalist Pitch Simulator

## Context

This is the take-home for the Pathos Communications role (`JOB_DESCRIPTION.md`). Pathos explicitly wants: a small, finished app for a PR company, built with AI, with commit history and a demo video showing spec thinking, how the AI was directed, and how the output was verified. They call out "professional skepticism toward AI output" as the thing they're grading for — which is exactly the pitch of this idea: an app whose entire premise is stress-testing AI-generated pitches against a skeptical AI gatekeeper before a human sends them.

The repo is already named `gatekeeper-ai`, which fits the product concept directly (an AI gatekeeper standing between the PR consultant and the journalist), so the plan adopts that as the product name.

**Scope decision:** keep this small and finished. The build is one polished thing — the interactive journalist simulator (Milestone 1) — plus one feature that turns a passing pitch into the thing you actually send: once the simulated journalist would book the meeting, the app compiles the refined pitch into a send-ready outreach email for the real journalist (Milestone 2). Everything else (RAG, multi-persona gauntlet, eval harness, routing/chaining workflows) was considered and deliberately cut to keep the app simple and the demo tight.

Stack: **TypeScript + Next.js (App Router)**, Anthropic TypeScript SDK, Tailwind for styling, no database (in-memory/session state only — this is a demo, not Pressella itself).

---

## Product Concept

**PR Consultant** pastes the client's news + a drafted pitch. Claude roleplays a specific, cynical journalist persona (e.g. a senior TechCrunch editor drowning in 500 pitches/day) and "reads" it live. On each turn the journalist-agent must pick one discrete action via tool use:

- `reject_pitch` — harsh, specific critique of why it doesn't work
- `request_data` — demands real metrics/evidence before considering it
- `ask_question` — a clarifying question (e.g. "why now?")
- `book_meeting` — accepts, proposes times

Every turn also emits a **Pitch Viability Score (0–100)** via structured output. The consultant edits the pitch and resubmits in the same thread until the journalist books the meeting (or gives up).

**When the simulated journalist would book the meeting**, the pitch has passed the gauntlet. Nothing has been sent yet — the whole session was a rehearsal. The app then compiles the *final refined pitch* — hardened by every edit the simulation forced out of the consultant — into a polished, ready-to-send outreach email for the **real** journalist, alongside a human-review checklist to run before hitting send.

## Feature Map — Course Topic → Product Feature

| Course topic | Where it's used |
|---|---|
| System prompts (persona) | Deep journalist persona: outlet, beat, seniority, pet peeves, tone — drives every response |
| Prompt engineering (clear/direct, specific, XML tags, examples) | Persona prompt is XML-structured (`<persona>`, `<beat>`, `<pet_peeves>`, `<rules>`); few-shot examples of real rejections/acceptances included |
| Tool use | `reject_pitch`, `request_data`, `ask_question`, `book_meeting` — forced single discrete action per turn |
| Structured outputs | `score_pitch` returns `{score, strengths[], weaknesses[], verdict}` (the Viability Score); `compose_pitch_email` returns the structured send-ready draft |
| Response streaming | Journalist's critique streams token-by-token in the transcript UI |
| Prompt caching | System prompt + persona marked `cache_control`; reused across the multi-turn thread and the email-compile call |
| Chaining / perspective switch | The email-compile step is a second, deterministic call that consumes the finished simulator thread and writes *as the consultant*, folding in every fact the simulation proved the pitch needed |

---

## Milestone 1 — MVP (DONE — the demoable app)

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
- Mark the system prompt block with `cache_control: {type: "ephemeral"}`.
- Conversation state kept client-side (React state) and replayed each turn — no DB needed for a single-session demo.

### Verification
- Run locally (`npm run dev`), manually test: a strong pitch → `book_meeting`; a vague pitch → `reject_pitch` or `request_data` with a real critique; confirm score updates every turn.
- Confirm streaming renders incrementally (not all-at-once) in the browser.
- Confirm the API route handles multi-turn: prior turns are replayed as message history, not just the latest.

### Phases (commit after each)
- [x] **1.1 Structure** — `create-next-app` (TS, Tailwind, App Router); lay out the folder structure from Structure above (`app/`, `lib/anthropic/`, `components/`) as empty/stub files; empty `page.tsx` shell.
- [x] **1.2 Design System** — `npx shadcn init`, define the theme (CSS variables in `app/globals.css`) and palette from Design System above; pull in the base `components/ui/*` pieces we'll need (button, badge, textarea, tabs, collapsible).
- [x] **1.3 CLAUDE.md** — now that real commands/folder layout/theme conventions exist: document stack, `npm run dev`/`build`/`lint` commands, folder structure, the shadcn/Tailwind theming rule (always use semantic tokens like `bg-primary`, never raw colors), and a pointer to `PROJECT_PLAN.md` for the feature roadmap. Guides every phase from here on.
- [x] **1.4 Persona + single tool-use call** — `personas.ts` (one hardcoded persona), `tools.ts` (just `reject_pitch` to start), `lib/anthropic/client.ts`; a non-streaming API route that returns one journalist turn for a hardcoded pitch (test via curl/Postman, no UI yet).
- [x] **1.5 Full tool set + structured score** — add `request_data`, `ask_question`, `book_meeting`, `score_pitch`; force `tool_choice`; wire multi-turn message history.
- [x] **1.6 Streaming** — convert the API route to `messages.stream()` over SSE/`ReadableStream`; parse text deltas + tool-use blocks as they arrive.
- [x] **1.7 UI wiring** — `PitchComposer`, `Transcript`, `ToolActionBadge`, `ScoreGauge` connected end-to-end to the streaming route. This is the MVP checkpoint — a complete, demoable app.

---

## Milestone 2 — Send-Ready Pitch Email

Layers onto Milestone 1 without changing its shape. When a turn's action is `book_meeting`, the pitch has cleared the gatekeeper. The transcript then shows a **"Compile the send-ready pitch"** button under that turn. Clicking it calls a new endpoint that rewrites the pitch as the actual cold-outreach email the consultant will send to the real journalist — rendered as an editable card with a before/after diff, a pre-send checklist, copy-to-clipboard, and a `mailto:` link.

### Why this is the right last feature

The app's premise is *stress-test the pitch before a human ever sends it*. The artifact of that process is the pitch itself — rewritten, tightened, and armed with the exact proof points the simulation forced out. `book_meeting` is just the unlock condition: "the gatekeeper would take this meeting, so this is ready to go out." Nothing in the session was ever sent; this is the first thing that leaves the building.

It's also the best place to show the AI being *directed well and checked*: the compiled email is only good if every edit traces back to something the simulation surfaced — the metric added after a `request_data` turn, the "why now" paragraph added after an `ask_question` turn, the buzzword stripped after a `reject_pitch`. And it never sends anything: it hands back a draft plus an explicit "verify before you send" list.

### How it works

New files:
```
app/api/compile-email/route.ts    # POST — takes the finished thread, returns a structured send-ready email
lib/anthropic/compose.ts           # compose_pitch_email tool schema + the consultant-voice system prompt
components/PitchEmail.tsx           # editable card: subject, body, before/after diff, pre-send checklist, copy / mailto
```

- **Input:** the full simulator `messages[]` history (already in `Simulator.tsx` state), the original pasted pitch (first user turn), the winning `score_pitch` breakdown (strengths to keep, weaknesses that got fixed), and the journalist persona (real name / outlet / beat / pet peeves).
- **One forced tool call** — `tool_choice: {type: "tool", name: "compose_pitch_email"}` — returns:
  ```ts
  {
    subject: string,             // tight and specific — never "Story idea" or "Quick question"
    body: string,                // the full outreach email, [[merge fields]] for anything not in the thread
    keyProofPoints: string[],    // the concrete facts that carried the pitch (pulled from the simulation)
    simulationEdits: string[],   // "Added retention data — journalist demanded it on turn 2", one per real change
    suggestedAttachments: string[],
    preSendChecklist: string[]   // the human-review gate: what to confirm before hitting send
  }
  ```
- **Perspective switch (the "chaining" beat for the video):** `/api/simulate` writes *as the journalist*. This route writes *as the consultant doing real outreach*, and is handed the journalist's pet peeves as anti-patterns to avoid ("recipient rejects buzzwords and vague claims — keep every sentence concrete, match their brevity").
- **Grounding rules in the system prompt:** the body must be built only from facts established in the thread; every proof point the journalist demanded must appear; strip anything the journalist flagged as filler; close with one specific, low-friction CTA (a short call, with `[[your availability]]` as a merge field — the consultant proposes times, *not* the fictional slots the simulated journalist "offered").
- **Never invent:** client contact details, real dates, embargo dates, headcount/revenue not stated in the thread → all `[[merge fields]]`.
- **Reuse the cached system block** where the persona text repeats — same `cache_control` pattern as Milestone 1.
- **UI:** `PitchEmail.tsx` renders subject + body as editable `<textarea>`s (pre-filled, tweak in place), a collapsible **before/after** view (original pasted pitch vs. compiled email) annotated with `simulationEdits`, the `preSendChecklist` as real checkboxes, a "Copy email" button, and a `mailto:?subject=…&body=…` link. Lives inline in the transcript under the `book_meeting` turn.

### Creative extensions (pick what fits the time; each is small)
- **Subject-line options** — return 2–3 subject lines each with a one-line rationale; consultant picks.
- **Run it back** — a "Would this still get the meeting?" button that sends the *compiled* email back through the simulator once as a final gut-check. Closes the app's own loop.
- **"What the simulation taught us"** — surface `simulationEdits` as a standalone highlight panel; it's the strongest evidence of AI-output verification for the demo video.
- **Length/warmth variants** — `compose_pitch_email` returns `cold` vs. `warm-intro` (already met) drafts; shadcn `Tabs` switch. One call, array output.
- **`.eml` download** — offer the draft as a downloadable `.eml` file, not just clipboard.

### Verification
- Compile off a strong multi-turn thread; confirm the email's proof points are the *specific* numbers/answers from that thread, not generic filler.
- Confirm every `request_data` / `ask_question` turn in the thread shows up as a concrete change in `simulationEdits` and in the body.
- Confirm no invented contact details / dates / figures — anything not in the thread comes out as a `[[merge field]]`.
- Confirm the CTA proposes the consultant's availability as a merge field, and does not reference the simulated journalist's fictional proposed times.
- Confirm the button is only offered on `book_meeting` turns.
- Confirm "Copy email", the `mailto:` link, and the `.eml` (if built) carry the edited text, not the original.

### Phases (commit after each)
- [x] **2.1 compose_pitch_email tool + route** — `lib/anthropic/compose.ts` (schema + consultant system prompt with the grounding rules), `app/api/compile-email/route.ts` forcing the single tool call; test via curl against a hand-written sample thread, no UI yet.
- [x] **2.2 PitchEmail card + trigger** — `components/PitchEmail.tsx`; "Compile the send-ready pitch" button on `book_meeting` turns in `Transcript.tsx`; wire to the route; editable subject/body, before/after diff, pre-send checklist, copy button + `mailto:` link.
- [x] **2.3 Polish** — "Run it back past the journalist" (a one-click cold read of the compiled email through `/api/simulate`, verdict + score shown inline on the card) and the always-visible "What the simulation changed" panel (promoted out of the Before/After tab). `TESTING.md` gains Tests 6–7; CLAUDE.md structure already updated in 2.1.

---

## Commit Cadence

Matches the job's "trunk-based, small commits, main always releasable" ethos: one commit per checked-off phase above (`1.1` … `2.3`), each left in a working state — never a giant single commit per milestone. Milestone 1 is a complete, demoable app on its own; Milestone 2 is additive and leaves it releasable at every phase.
