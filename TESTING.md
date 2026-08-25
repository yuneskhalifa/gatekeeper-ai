# Testing — Phase 1.5 / 1.6 (full tool set + score + multi-turn + streaming)

Manual test guide for `app/api/simulate/route.ts` as of Phase 1.6. No UI
yet (that's Phase 1.7) — this is all `curl` against the API route
directly. Extend this file as later phases add more to test.

## Prerequisites

1. `npm install`
2. `.env.local` has a real `ANTHROPIC_API_KEY` (copy from `.env.example` if you haven't already)
3. `npm run dev` — leave it running in one terminal, run the commands below in another

## What the route does

`POST /api/simulate` takes `{ "messages": [...] }` (an Anthropic-format
message array — empty-ish on turn 1, just the latest user pitch/reply)
and now (Phase 1.6) responds as a **Server-Sent Events stream**
(`Content-Type: text/event-stream`) instead of one JSON blob. Each
`data: {...}` line is one event, in this order:

```
action_start
action_delta   (repeated — partial tool-input JSON as it's generated)
action         (final: { name, input })
score_start
score_delta    (repeated)
score          (final: score_pitch's input)
done           (full updated `messages` array to send back next turn)
```

or an `error` event at any point (stream still closes normally after).

The non-streaming examples below (Tests 1-3) still work conceptually,
but now return a stream, not one JSON object — see "Test 4" for how to
read the final result out of a stream from the shell, and "Test 5" for
proving it's actually incremental and not buffered.

<details>
<summary>Old non-streaming shape (Phase 1.5, for reference)</summary>

```json
{
  "action": { "name": "reject_pitch" | "request_data" | "ask_question" | "book_meeting", "input": { ... } },
  "score": { "score": 0-100, "strengths": [...], "weaknesses": [...], "verdict": "..." },
  "messages": [ ...full updated history, feed this back in as "messages" on the next call... ]
}
```
</details>

Every call still makes two forced tool-use requests to Claude under the
hood — one forced to pick exactly one of the four action tools, one
forced to always call `score_pitch` — now streamed as SSE events as
described above instead of returned as one blob.

**Use `curl -N`** (no-buffer) for all of these, not plain `curl -s` —
without `-N` curl may wait for the full response before printing
anything, which defeats the point of checking that it streams.

## Test 1 — weak pitch (expect a low score + reject_pitch)

```bash
curl -s -N -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Subject: Revolutionary AI Startup Disrupts Everything\n\nHi, our AI platform is a game-changer for businesses everywhere. We use cutting-edge machine learning to transform how companies operate. Let me know if you would like to chat!"}]}' \
  | grep -E '"type":"(action|score|error)"'
```

(The `grep` filters out the `*_delta`/`*_start` noise so you just see
the final `action` and `score` events — drop the `grep` entirely if you
want to watch the raw token-by-token stream go by.)

**Look for:** the `action` event's `name` is `reject_pitch`, its
`input.critique` is specific (calls out the actual buzzwords/missing
metrics, not generic feedback), the `score` event's `score` is low
(single digits/low tens).

## Test 2 — strong pitch (expect a high score, maybe book_meeting)

```bash
curl -s -N -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Subject: How Acme Robotics cut warehouse picking errors 40% at 3 mid-size 3PLs (case study + data)\n\nWe have real before/after numbers from three customers, a technical breakdown of how the system works, and the founder is a former Amazon robotics lead willing to go deep on the mechanics. Happy to share the case study data under embargo ahead of a Tuesday launch."}]}' \
  | grep -E '"type":"(action|score|error)"'
```

**Look for:** the score noticeably higher than Test 1, the action
likely `book_meeting` or `ask_question` rather than `reject_pitch`.

## Test 3 — multi-turn (does it remember the thread?)

This is the important one — it proves conversation history actually
carries across calls, not just per-request state. Since the response is
now a stream, we pull the `messages` array out of the final `done`
event rather than out of a plain JSON body.

1. Run Test 1's `curl`, but write the full raw stream to a file instead
   of grepping it:
   ```bash
   curl -s -N -X POST http://localhost:3000/api/simulate \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Subject: Revolutionary AI Startup Disrupts Everything\n\nHi, our AI platform is a game-changer for businesses everywhere. We use cutting-edge machine learning to transform how companies operate. Let me know if you would like to chat!"}]}' \
     > turn1_stream.txt
   ```
2. Build a turn-2 request: pull `messages` out of turn 1's `done` event
   and append a refined pitch:
   ```bash
   python3 - turn1_stream.txt turn2_request.json <<'PY'
   import json, sys
   for line in open(sys.argv[1]):
       if line.startswith("data: ") and '"type":"done"' in line:
           done = json.loads(line[len("data: "):])
           break
   else:
       raise SystemExit("no done event found — did turn 1 error out?")
   messages = done["messages"]
   messages.append({
       "role": "user",
       "content": "Revised pitch: Subject: How Nimbus Health cut ER triage time 28% at 4 hospital systems (case study + data)\n\nWe have before/after numbers from four hospital systems, a technical breakdown of the triage model, and the founder is a former Cleveland Clinic ER director willing to go deep on the mechanics. Happy to share the case study data under embargo ahead of a Tuesday launch."
   })
   json.dump({"messages": messages}, open(sys.argv[2], "w"))
   PY
   ```
3. Send it:
   ```bash
   curl -s -N -X POST http://localhost:3000/api/simulate \
     -H "Content-Type: application/json" \
     --data-binary @turn2_request.json | grep -E '"type":"(action|score|error)"'
   ```

**Look for:** the second response reacting *in context* of the first —
e.g. referencing the earlier rejection, treating this as a follow-up
rather than a cold pitch, and the score changing to reflect the
improvement. If the persona's `beat` doesn't match the pitch topic
(e.g. a B2B SaaS journalist getting a healthcare pitch), a good sign is
it noticing that mismatch explicitly rather than ignoring it.

## Test 4 — confirm it's actually streaming, not buffered

The whole point of Phase 1.6. Print each line with a timestamp and
check the deltas are spread out over time, not all printed at once:

```bash
curl -s -N -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Subject: Revolutionary AI Startup Disrupts Everything\n\nHi, our AI platform is a game-changer for businesses everywhere. We use cutting-edge machine learning to transform how companies operate. Let me know if you would like to chat!"}]}' \
  | while IFS= read -r line; do
      [ -n "$line" ] && printf "%s  %s\n" "$(date +%H:%M:%S.%3N)" "${line:0:70}"
    done
```

**Look for:** the timestamps on consecutive `action_delta`/`score_delta`
lines climbing gradually (milliseconds to low-seconds apart) across the
whole response, not one timestamp for the first line and another
identical-ish timestamp for everything after it (which would mean it
got buffered and dumped all at once).

## Try your own pitches

Swap the `content` string in Test 1/2 for anything you want — a real
draft pitch, something deliberately vague, something with fabricated
metrics — and see how Marcus Chen (the only persona so far,
`lib/anthropic/personas.ts`) reacts. Repeat the Test 3 pattern to keep
refining in the same thread.

## Failure modes to know about

- **`{"type":"error","message":"Journalist did not take an action."}` / `"...did not return a score."`** as an SSE event — the forced tool-use call didn't produce a tool_use block. Shouldn't happen with `tool_choice` forcing it; the stream still closes normally right after.
- **`cache_creation_input_tokens: 0`** in the raw Anthropic response (visible if you inspect the SDK response directly, not in the SSE events) is expected right now — the system prompt is under Anthropic's ~1024-token minimum for caching to kick in. Not a bug (see Phase 1.4 notes in conversation).
- **No output at all for several seconds after `action_start`** — normal. That gap is Claude generating; `action_delta` events only start once the tool-input JSON begins streaming, not the moment the request is sent.
