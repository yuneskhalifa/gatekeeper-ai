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
- A "Yunes is reading..." placeholder pulses, then gets replaced by a badge + reaction text — text should visibly stream in, not pop in all at once
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

This is the actual product pitch (a consultant iterating the *same*
pitch until it lands) — same company both times, the second message is
a rewrite that fixes exactly what got the first one rejected, not a
different client.

1. Send **UI Test 1**'s weak pitch. Let it fully resolve (rejected, low score). Note it never actually names the company — that's part of why it's weak.
2. In the same session (don't refresh the page — the thread lives in React state), send a revision of that *same* pitch, now with the specifics Yunes said were missing (real metrics, named customers, a credible founder), and on-beat for B2B SaaS so this test is purely about refinement, not a beat mismatch:
   ```
   Revised pitch: Subject: How Vantix AI cut sales-ops busywork 35% at 5 mid-market B2B teams (case study + data)

   We have before/after numbers from five customers, a technical breakdown of how the automation works, and the founder is a former Salesforce product lead willing to go deep on the mechanics. Happy to share the case study data under embargo ahead of a Tuesday launch.
   ```
3. Confirm both turns stay visible, stacked in the transcript, and the second turn's action/score reacts *in context of the first* — e.g. it may explicitly acknowledge this is a stronger version of the same pitch rather than treating it as a cold, unrelated one. Score should move up noticeably from turn 1, and the action should move away from `reject_pitch`.
4. Refresh the page and confirm the transcript resets to empty — there's no persistence yet (by design, Milestone 1 is client-state only), so this is expected, not a bug.

## Try your own pitches

Paste anything you want — a real draft pitch, something deliberately
vague, something with fabricated metrics — and see how Yunes Khalifa (the
only persona so far, `lib/anthropic/personas.ts`) reacts. Follow up in
the same thread to keep refining, same pattern as UI Test 4.

## Failure modes to know about

- **A red error line in place of a badge** — the forced tool-use call didn't produce a tool_use block. Shouldn't happen with `tool_choice` forcing it.
- **A few seconds of silence before anything appears** — normal. That gap is Claude generating before the tool-input JSON starts streaming.
- **Refreshing the page loses the thread** — expected, not a bug. There's no persistence yet; conversation state lives only in React state for this session.
