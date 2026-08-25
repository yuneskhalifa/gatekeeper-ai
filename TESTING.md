# Testing — Phase 1.5 (full tool set + score + multi-turn)

Manual test guide for `app/api/simulate/route.ts` as of Phase 1.5. No UI
yet (that's Phase 1.7) — this is all `curl` against the API route
directly. Extend this file as later phases add more to test.

## Prerequisites

1. `npm install`
2. `.env.local` has a real `ANTHROPIC_API_KEY` (copy from `.env.example` if you haven't already)
3. `npm run dev` — leave it running in one terminal, run the commands below in another

## What the route does

`POST /api/simulate` takes `{ "messages": [...] }` (an Anthropic-format
message array — empty-ish on turn 1, just the latest user pitch/reply)
and returns:

```json
{
  "action": { "name": "reject_pitch" | "request_data" | "ask_question" | "book_meeting", "input": { ... } },
  "score": { "score": 0-100, "strengths": [...], "weaknesses": [...], "verdict": "..." },
  "messages": [ ...full updated history, feed this back in as "messages" on the next call... ]
}
```

Every call makes two forced tool-use requests to Claude under the hood:
one forced to pick exactly one of the four action tools, one forced to
always call `score_pitch` — so you should get both an `action` and a
`score` on every response, never just one.

## Test 1 — weak pitch (expect a low score + reject_pitch)

```bash
curl -s -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Subject: Revolutionary AI Startup Disrupts Everything\n\nHi, our AI platform is a game-changer for businesses everywhere. We use cutting-edge machine learning to transform how companies operate. Let me know if you would like to chat!"}]}' \
  | python3 -m json.tool
```

**Look for:** `action.name` is `reject_pitch`, `action.input.critique` is
specific (calls out the actual buzzwords/missing metrics, not generic
feedback), `score.score` is low (single digits/low tens).

## Test 2 — strong pitch (expect a high score, maybe book_meeting)

```bash
curl -s -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Subject: How Acme Robotics cut warehouse picking errors 40% at 3 mid-size 3PLs (case study + data)\n\nWe have real before/after numbers from three customers, a technical breakdown of how the system works, and the founder is a former Amazon robotics lead willing to go deep on the mechanics. Happy to share the case study data under embargo ahead of a Tuesday launch."}]}' \
  | python3 -m json.tool
```

**Look for:** `score.score` noticeably higher than Test 1, `action.name`
likely `book_meeting` or `ask_question` rather than `reject_pitch`.

## Test 3 — multi-turn (does it remember the thread?)

This is the important one — it proves conversation history actually
carries across calls, not just per-request state.

1. Run Test 1, save the response: append `> turn1.json` to the curl
   command above instead of piping to `json.tool`.
2. Build a turn-2 request that appends a refined pitch onto turn 1's
   returned `messages`:
   ```bash
   python3 - turn1.json turn2_request.json <<'PY'
   import json, sys
   turn1 = json.load(open(sys.argv[1]))
   messages = turn1["messages"]
   messages.append({
       "role": "user",
       "content": "Revised pitch: Subject: How Nimbus Health cut ER triage time 28% at 4 hospital systems (case study + data)\n\nWe have before/after numbers from four hospital systems, a technical breakdown of the triage model, and the founder is a former Cleveland Clinic ER director willing to go deep on the mechanics. Happy to share the case study data under embargo ahead of a Tuesday launch."
   })
   json.dump({"messages": messages}, open(sys.argv[2], "w"))
   PY
   ```
3. Send it:
   ```bash
   curl -s -X POST http://localhost:3000/api/simulate \
     -H "Content-Type: application/json" \
     --data-binary @turn2_request.json | python3 -m json.tool
   ```

**Look for:** the second response reacting *in context* of the first —
e.g. referencing the earlier rejection, treating this as a follow-up
rather than a cold pitch, and the score changing to reflect the
improvement. If the persona's `beat` doesn't match the pitch topic
(e.g. a B2B SaaS journalist getting a healthcare pitch), a good sign is
it noticing that mismatch explicitly rather than ignoring it.

## Try your own pitches

Swap the `content` string in Test 1/2 for anything you want — a real
draft pitch, something deliberately vague, something with fabricated
metrics — and see how Marcus Chen (the only persona so far,
`lib/anthropic/personas.ts`) reacts. Repeat the Test 3 pattern to keep
refining in the same thread.

## Failure modes to know about

- **502 `"Journalist did not take an action."` / `"...did not return a score."`** — the forced tool-use call didn't produce a tool_use block. Shouldn't happen with `tool_choice` forcing it, but if you see it, check the raw response included in the error body.
- **`cache_creation_input_tokens: 0`** in the raw Anthropic response is expected right now — the system prompt is under Anthropic's ~1024-token minimum for caching to kick in. Not a bug (see Phase 1.4 notes in conversation).
