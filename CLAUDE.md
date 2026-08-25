@AGENTS.md

# Gatekeeper AI

The "Ruthless Journalist" Pitch Simulator — a PR consultant pastes a
client's news + a drafted pitch, and Claude roleplays a specific,
cynical journalist persona who reads it and picks one action
(reject / request data / ask a question / book the meeting) via tool
use, with a live 0–100 viability score.

Full product spec, feature map, and phased build plan: **`PROJECT_PLAN.md`**.
Read it before starting a new phase — it defines what each phase is
and which course/Claude API feature it demonstrates.

## Stack

TypeScript + Next.js (App Router) + Tailwind CSS v4 + shadcn/ui, the
Anthropic TypeScript SDK. No database — conversation state is
client-side only, this is a demo app, not Pressella itself.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build (also type-checks)
- `npx tsc --noEmit` — type-check only
- `npm run lint` — ESLint
- `npm run evals` — model-graded eval harness (added in Milestone 5, `scripts/evals/`)

## Structure

```
app/
  page.tsx                 # simulator UI
  api/simulate/route.ts    # POST — streams a journalist turn
  api/gauntlet/route.ts    # POST — parallel multi-persona "Gauntlet Mode" (Milestone 4)
lib/
  anthropic/                # SDK client, persona system prompts, tool schemas
  rag/                       # BM25 chunking/indexing/retrieval (Milestone 3)
  agents/                    # routing/chaining workflow calls (Milestone 4)
components/
  ui/                        # shadcn/ui primitives — owned source, not a dependency
  *.tsx                      # app-specific components (Simulator, Transcript, ...)
data/
  journalists/*.md          # persona corpus (Milestone 3)
  playbook/*.md              # PR best-practice corpus (Milestone 3)
scripts/evals/                # model-graded eval harness (Milestone 5)
```

## Design system

shadcn/ui on top of Tailwind — components live in `components/ui/*` as
owned source (added via `npx shadcn add <name>`, then edited freely).

**Always use the semantic theme tokens, never a raw color.** Every
color in this app comes from the CSS variables defined once in
`app/globals.css` (`--background`, `--foreground`, `--primary`,
`--destructive`, `--muted`, `--border`, ...) and surfaced as Tailwind
classes (`bg-primary`, `text-muted-foreground`, `border-border`, ...).
Do not reach for `bg-blue-500`, a hex code, or a new one-off color
variable — reuse the existing tokens, or if a new semantic need
genuinely doesn't fit any of them, add it to `globals.css` as a new
token rather than inlining a color in a component.

The palette is dark, newsroom/editorial neutrals with a single warm
gold accent doing double duty as `--primary` (accept / book_meeting
states); `--destructive` stays shadcn's default red, used as-is via
the existing variant system for reject states. Dark mode is the
default (`dark` class on `<html>` in `app/layout.tsx`), no toggle.

## Conventions

- Small, working commits — trunk-based, one commit per phase checkbox
  in `PROJECT_PLAN.md`. **The user makes the commits, not Claude Code**
  — implement and verify a phase, then hand it back rather than
  running `git commit` yourself.
- Anthropic API calls live in `lib/anthropic/` and `lib/agents/` only —
  don't call the SDK directly from components or route handlers.
