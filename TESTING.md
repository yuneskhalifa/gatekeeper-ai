# Testing — Milestone 1 (persona, tools, streaming, UI)

Manual test guide for the simulator UI as of Phase 1.7. Extend this
file as later phases add more to test.

## Prerequisites

1. `npm install`
2. `.env.local` has a real `ANTHROPIC_API_KEY` (copy from `.env.example` if you haven't already)
3. `npm run dev` — leave it running in one terminal

## Testing the UI

Open `http://localhost:3000`. Paste each pitch below into the textarea
and hit **Send Pitch** (or ⌘/Ctrl+Enter). For each one, check:

- The pitch appears immediately as its own bubble
- A "Marcus is reading..." placeholder pulses, then gets replaced by a badge + reaction text — text should visibly stream in, not pop in all at once
- Once the action resolves, "scoring..." pulses, then the score bar/verdict/strengths/weaknesses appear
- The **Send Pitch** button is disabled (says "Reading...") for the whole turn, so you can't submit a second pitch mid-turn
- The textarea clears after sending

### UI Test 1 — weak pitch → expect a destructive "Rejected" badge, low score

```
Subject: Revolutionary AI Startup Disrupts Everything

Hi, our AI platform is a game-changer for businesses everywhere. We use cutting-edge machine learning to transform how companies operate. Let me know if you'd like to chat!
```

**Look for:** red/destructive "Rejected" badge, a specific critique (not generic feedback — should call out the actual buzzwords), score bar low (roughly single digits to low tens).

### UI Test 2 — borderline pitch → expect a question or a data request

```
Subject: New AI tool for customer support teams

We just launched a tool that helps support teams answer tickets faster using AI. A few companies are already using it and seeing good results. Happy to share more details if you're interested.
```

**Look for:** an outline "Question Asked" or secondary "Data Requested" badge (not an immediate reject or accept) — this pitch is vague but not pure buzzword soup, so the interesting thing to check is whether the journalist asks for exactly the missing piece (real numbers, which companies) rather than a generic "tell me more."

### UI Test 3 — strong pitch → expect "Meeting Booked" or a close question, high score

```
Subject: How Acme Robotics cut warehouse picking errors 40% at 3 mid-size 3PLs (case study + data)

We have real before/after numbers from three customers, a technical breakdown of how the system works, and the founder is a former Amazon robotics lead willing to go deep on the mechanics. Happy to share the case study data under embargo ahead of a Tuesday launch.
```

**Look for:** default/primary "Meeting Booked" badge (or at worst "Question Asked" if it wants one more detail), score bar noticeably higher than Test 1 — should land in the 70-90s range, strengths list populated, weaknesses list short or empty.

### UI Test 4 — multi-turn refinement, in the same thread

This is the actual product pitch (a consultant iterating until the pitch lands):

1. Send **UI Test 1**'s weak pitch. Let it fully resolve (rejected, low score).
2. In the same session (don't refresh the page — the thread lives in React state), send a refined version as a follow-up:
   ```
   Revised pitch: Subject: How Nimbus Health cut ER triage time 28% at 4 hospital systems (case study + data)

   We have before/after numbers from four hospital systems, a technical breakdown of the triage model, and the founder is a former Cleveland Clinic ER director willing to go deep on the mechanics. Happy to share the case study data under embargo ahead of a Tuesday launch.
   ```
3. Confirm both turns stay visible, stacked in the transcript, and the second turn's action/score reacts *in context* — e.g. it may flag that healthcare is outside Marcus's B2B SaaS beat even though the pitch quality improved. Score should move up from turn 1.
4. Refresh the page and confirm the transcript resets to empty — there's no persistence yet (by design, Milestone 1 is client-state only), so this is expected, not a bug.

## Try your own pitches

Paste anything you want — a real draft pitch, something deliberately
vague, something with fabricated metrics — and see how Marcus Chen (the
only persona so far, `lib/anthropic/personas.ts`) reacts. Follow up in
the same thread to keep refining, same pattern as UI Test 4.

## Failure modes to know about

- **A red error line in place of a badge** — the forced tool-use call didn't produce a tool_use block. Shouldn't happen with `tool_choice` forcing it.
- **A few seconds of silence before anything appears** — normal. That gap is Claude generating before the tool-input JSON starts streaming.
- **Refreshing the page loses the thread** — expected, not a bug. There's no persistence yet; conversation state lives only in React state for this session.
