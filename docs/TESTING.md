# Testing

Milestone 1 (Tests 1–5): persona/tool behavior across all four
actions, structured scoring, streaming, multi-turn memory, and
composer/UI mechanics.

Milestone 2 (Tests 6–8): compiling a passed pitch into a send-ready
outreach email, answering the gaps the score still flagged, and
sending it over SMTP.

## Prerequisites

1. `npm install`
2. `.env.local` has a real `ANTHROPIC_API_KEY`
3. `npm run dev` — open `http://localhost:3000`

---

## Test 1 — Cold start (empty state + no persistence)

Covers: initial UI state, empty-state copy, client-only state.

1. Load the page fresh (or refresh it). Don't send anything yet.
2. Confirm: the header shows "Yunes Khalifa · Journalist · TechCrunch · Early-stage B2B SaaS and applied-AI startups", the transcript area shows the empty-state line ("Nobody's pitched him yet today." + the caption beneath it), and the composer is empty with the send button disabled (nothing typed yet).
3. Send any pitch, let it resolve, then **refresh the page**.
4. Confirm the transcript goes back to the empty state — there's no persistence yet (client-only state), so this is expected, not a bug.

---

## Test 2 — Weak pitch → reject, streamed, scored low

Covers: `reject_pitch` tool, `score_pitch` structured output, response streaming, the "Rejected" stamp.

Paste and send:
```
Subject: Revolutionary AI Startup Disrupts Everything

Hi, our AI platform is a game-changer for businesses everywhere. We use cutting-edge machine learning to transform how companies operate. Let me know if you'd like to chat!
```

Watch it happen, don't just check the final state:
- A pulsing "Yunes is reading..." placeholder appears immediately, then the critique text visibly streams in over ~1-2 seconds (not a single pop-in)
- Then "scoring..." pulses before the score bar/verdict/lists appear (also streamed)
- **Final state:** red/destructive "Rejected" stamp, a specific critique that names the actual problems (buzzwords, no metrics, no reason to care now) rather than generic feedback, score in the single digits to low teens, weaknesses list populated and strengths list short or empty

---

## Test 3 — Borderline pitch → a soft action (question or data request)

Covers: `ask_question` / `request_data` tools, the "outline"/"secondary" stamp styling, mid-range scoring.

Paste and send:
```
Subject: Loopwise cuts support ticket response time ~50% for early customers

We're working with about a dozen mid-market support teams who've seen roughly a 50% drop in average response time using our AI triage tool. We don't have a formal case study written up yet, but I can get you exact numbers and a customer reference on the record if you're interested in digging into the details.
```

This pitch is deliberately half-real: a named product, a believable metric, and real customer traction — but everything is hedged ("about," "roughly," "if you're interested") instead of delivered. Verified 3/3 runs land as `request_data` with scores in the low-to-mid 40s-60s — mid-range, not a reject.

**Look for:** a muted-outline "Data Requested" (or "Question Asked") stamp — not an immediate reject, not an accept. The request should be for exactly the specific missing piece (the actual numbers, a named customer, what makes it different from competitors) rather than a generic "tell me more." Score should land clearly above Test 2's and clearly below Test 4's.

---

## Test 4 — Strong pitch → book_meeting with structured fields

Covers: `book_meeting`'s `proposedTimes`/`notes` fields rendering correctly, the primary/gold stamp, high scoring.

Paste and send:
```
Subject: How Acme Robotics cut warehouse picking errors 40% at 3 mid-size 3PLs (case study + data)

We have real before/after numbers from three customers, a technical breakdown of how the system works, and the founder is a former Amazon robotics lead willing to go deep on the mechanics. Happy to share the case study data under embargo ahead of a Tuesday launch.
```

**Look for:** gold/primary "Meeting Booked" stamp (or at worst "Question Asked" if it wants one more detail before committing), the reaction text actually contains proposed times (not blank or "undefined"), score noticeably higher than Tests 2 and 3 — should land roughly 70-90 — with a populated strengths list and a short/empty weaknesses list.

---

## Test 5 — Multi-turn refinement + composer mechanics

Covers: conversation memory across turns, the composer's disabled/clearing/keyboard-shortcut behavior, error resilience.

1. Send Test 2's weak pitch. While it's in flight, confirm: the **Send** button is disabled and the hint text below the composer switches to "Yunes is reading...", and you cannot submit a second message until it resolves.
2. Once it resolves (rejected, low score), confirm the textarea cleared itself after sending in step 1.
3. In the same session, send a revision of the *same* company/pitch — not a different one — that fixes exactly what got it rejected:
   ```
   Revised pitch: Subject: How Vantix AI cut sales-ops busywork 35% at 5 mid-market B2B teams (case study + data)

   We have before/after numbers from five customers, a technical breakdown of how the automation works, and the founder is a former Salesforce product lead willing to go deep on the mechanics. Happy to share the case study data under embargo ahead of a Tuesday launch.
   ```
   This time, type it and submit with **⌘/Ctrl+Enter** instead of clicking Send, to confirm the keyboard shortcut works.
4. Confirm both turns stay stacked in the transcript, the second turn's reaction is *in context* of the first (may reference this being a stronger version of the same pitch rather than a cold one), and the score moved up noticeably from turn 1.
5. Yunes will likely respond to the Vantix revision with `ask_question` rather than booking immediately (commonly asking about differentiation from Salesforce Einstein/Clari/Gong, or about launch exclusivity/timing) — close the loop by answering it in a third turn:
   ```
   Vantix automates the manual sales-ops work reps hate: logging call notes into the CRM, updating deal stage and next-step fields after every call, and drafting the follow-up email — all done automatically from the call recording, not typed in by a rep. Einstein, Clari, and Gong all sit on top of data reps already entered by hand; they forecast and surface insights, but someone still has to do the data entry. Vantix removes that step entirely — it's the data entry, not another dashboard. We closed a $3.2M seed round in Q2, have 5 paying mid-market customers averaging $2,400/month, and can put you directly on a call with two of them. This is exclusive to you — no other outlet has it — and the launch is next Tuesday at 9am ET.
   ```
   Verified 3/3 runs: this closes the loop as `book_meeting` with a score in the mid-80s and real proposed meeting times in the reaction text — confirming the thread genuinely accumulates credibility across turns rather than resetting each time.
6. Send an empty/whitespace-only message (or just hit send with nothing typed) — confirm the Send button stays disabled and nothing gets submitted.

---

## Test 6 — Compile a passed pitch into a send-ready email

Covers: the `book_meeting` trigger, `/api/compile-email`, `compose_pitch_email` structured output, the `PitchEmail` card, grounding + merge-field discipline.

1. Run a pitch through to **Meeting Booked** — fastest path is Test 4's Acme Robotics pitch, or the full Test 5 refinement flow if you want a multi-turn thread.
2. Under that turn a gold callout appears. If the score for that turn still listed **weaknesses**, the callout reads "Answer the N gaps Yunes flagged…" / "Strengthen & compile" — see Test 8. If there were no weaknesses it reads "Your pitch cleared the gatekeeper." / "Compile". Click it (with no weaknesses, this compiles straight away).
3. A pulsing "Compiling the send-ready pitch..." shows, then the **Send-Ready Pitch** card renders. Confirm:
   - **Subject** is specific to the story, not "Story idea" / "Quick question".
   - **Body** is built only from facts in the thread. Anything it can't know — the consultant's name, contact details, exact availability, embargo date — appears as a highlighted `[[merge field]]`, never invented. The "N merge fields to fill in" counter matches what's visible.
   - The CTA proposes the consultant's availability as a merge field — it does **not** quote the times Yunes "offered" in the simulation.
   - **What the simulation changed** (top panel) lists concrete edits, each tied to a journalist turn (e.g. "Added the 40% figure — journalist ran request_data on turn 2"). On a multi-turn thread every `request_data` / `ask_question` turn should be represented.
   - **Attach before sending** and **Pre-send checklist** are populated; clicking an item strikes it through.
4. Edit the subject and body. Click **Copy email**, paste into a scratch buffer — confirm it's the *edited* text with a `Subject:` line.
5. Open the **Before / After** tab — confirm the original pasted pitch shows on the left, the compiled email (with merge fields highlighted) on the right, and **Proof points carried in** lists the concrete facts.
6. Confirm the Compile callout only appears on a `book_meeting` turn, and only on the most recent turn — send another pitch after booking and the old callout is gone.

---

## Test 7 — Send the compiled email over SMTP

Covers: the editable recipient field, the send gate, `/api/send-email`, `lib/email/mailer.ts`.

**Send gate (no SMTP config needed):**
1. From the card in Test 6, leave the **To** field empty — confirm **Send email** is disabled.
2. Type an obviously bad address (`not-an-email`) — confirm a red "Enter a valid email address." hint shows and Send stays disabled.
3. Type a valid address but leave a `[[merge field]]` in the body — confirm Send stays disabled with a "Fill in the merge fields to enable send." hint.
4. Fill every merge field and enter a valid address — confirm **Send email** enables.

**Not configured:**
5. With no `SMTP_*` vars in `.env.local`, click **Send email** — confirm it shows "Sending..." then a red error: "SMTP isn't configured. Set SMTP_HOST…".

**Actually sending:**
6. Put working SMTP creds in `.env.local` (a Mailtrap/Ethereal sandbox inbox is ideal — see `.env.example`), restart `npm run dev`.
7. Enter your own address in **To**, click **Send email**. Confirm the button goes "Sending..." → "Sent" (and stays disabled), and a "Email sent to …" line appears.
8. Check the destination inbox — confirm the message arrived with the *edited* subject and body (plain text), from `SMTP_FROM`.
9. Re-check `/api/send-email` rejects a body containing `[[...]]` even if the client is bypassed (optional: curl it directly).

---

## Test 8 — Weakness pass before compiling

Covers: the answer-or-skip form on `book_meeting` turns with remaining weaknesses, the `/api/vet-answers` sanity check, `weaknessResponses[]` → `/api/compile-email`, grounding of consultant-supplied answers.

1. Get to **Meeting Booked** on a turn whose score still shows a populated **Weaknesses** column (Test 4's Acme pitch usually books with 2–4 weaknesses still listed — "no revenue mentioned", "company stage unclear", etc.).
2. The callout reads "Answer the N gaps Yunes flagged, then compile the email." with a **Strengthen & compile** action. Click it.
3. Confirm an inline form appears: one red-bulleted weakness per row, each with its own answer box and the hint "Leave a box blank to skip that point."
4. Answer one or two, leave the rest blank. Confirm the primary button label reflects the count ("Compile with 2 answers"); clearing all boxes changes it to "Compile without answering".
5. **Nonsense check:** put a junk answer in one box (`asdf banana 42`) and a real answer in another, then click compile. Confirm the button shows "Checking answers..." briefly, then:
   - the junk row gets a red border and a "⚠ …" line explaining it doesn't hold up
   - the form does **not** compile — it stays open
   - the header hint switches to "1 answer didn't hold up — revise it or clear the box to skip…"
   - the button becomes **Re-check & compile**
6. Fix the junk row (or clear it to skip) and click **Re-check & compile**. Editing a flagged box clears its warning immediately. Confirm it now passes and compiles.
7. Click it. Confirm it compiles (pulsing → card).
8. On the card, confirm:
   - Each **answered** point is now reflected in the body as a concrete statement.
   - Each **skipped** point is NOT in the body — it wasn't invented or hand-waved.
   - **What the simulation changed** attributes the new lines to the consultant's post-simulation input, not to a journalist turn.
9. Click **Cancel** on a fresh run instead — confirm it returns to the plain callout without compiling.
10. Confirm a `book_meeting` turn with an empty Weaknesses column skips the form entirely (plain "Compile" — Test 6).
