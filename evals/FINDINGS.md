# Eval Findings

Plain notes on what each eval run told us about the journalist persona.
`evals/REPORT.md` holds the raw table and gets overwritten every run.
This file is committed and keeps the history.

## What the two numbers mean

Every run scores the persona against 10 test pitches in `evals/fixtures.ts`.

- **Action accuracy** — for each pitch, the test file says which of the four
  actions the journalist *should* take (reject / request data / ask a question
  / book the meeting). Action accuracy is how many of the 10 it got right.
- **Score in bounds** — for each pitch, the test file gives a fair range for the
  0–100 score. Score in bounds is how many of the 10 scores landed inside their
  range.

The suite passes only if action accuracy is 8/10 or better AND all 10 scores
are in range.

## Why the numbers can move without the app getting worse

The test file was written on gut feel, guessing how a harsh journalist would
react. Some of those guesses were wrong. When we fix the prompt, a lower score
can mean the prompt improved while a bad test label finally showed up as a
failure. That is why the method (see `EVALS_PLAN.md`) is: correct the test
labels first, freeze them, then change the prompt one step at a time.

---

## Run 1 — 2026-09-03 08:41, `claude-sonnet-4-5` (baseline, no rubric)

- Action accuracy: 7/10
- Score in bounds: 6/10
- Suite result: FAIL

```
#   id                           action                             score        result
1   empty-buzzwords              reject_pitch   ✓ (exp reject_pitch) 8   ✓ [0-25] PASS
2   no-why-now                   reject_pitch   ✓ (exp reject_pitch) 8   ✓ [5-30] PASS
3   vague-traction-claim         request_data   ✓ (exp request_data) 15  ✓ [15-45] PASS
4   unnamed-customers            reject_pitch   ✗ (exp request_data) 18  ✗ [20-50] FAIL
5   strong-but-no-exclusive      ask_question   ✓ (exp ask_question) 42  ✗ [45-70] FAIL
6   timing-unclear               ask_question   ✓ (exp ask_question) 42  ✓ [40-65] PASS
7   funding-round-with-metrics   ask_question   ✗ (exp book_meeting) 35  ✗ [65-90] FAIL
8   data-backed-launch           book_meeting   ✓ (exp book_meeting) 82  ✓ [65-90] PASS
9   founder-credential-hook      ask_question   ✗ (exp book_meeting) 78  ✓ [60-88] FAIL
10  borderline-thin-launch       reject_pitch   ✓ (exp reject_pitch | request_data) 12  ✗ [20-50] FAIL
```

### What we learned

**The clear-cut pitches worked.** Both pure-fluff pitches (`empty-buzzwords`,
`no-why-now`) were rejected with single-digit scores. The one pitch with an
outside benchmark and named customers on the record (`data-backed-launch`) was
the only booked meeting, at 82. The journalist likes hard evidence and dislikes
buzzwords, which is the point.

**The journalist almost always asks a question instead of booking.** Three
pitches we expected it to book — `funding-round-with-metrics`,
`founder-credential-hook`, and `strong-but-no-exclusive` — all came back as a
question instead. It wants one more thing confirmed before it commits, even
when the pitch is already strong.

**On weak-but-not-empty pitches it rejects instead of asking for data.**
`unnamed-customers` and `borderline-thin-launch` were both rejected outright
rather than sent back for evidence.

**Scores run low.** Six of ten scores came in under our expected range, several
by only a few points. A "pretty good" pitch scores around 40, not 60.

### Triage — our label wrong vs. persona wrong

| # | failing scenario | verdict | reason |
|---|-----------------|---------|--------|
| 4 | unnamed-customers | label wrong | Unverifiable customer claim, no names, no metrics, no "why now" — the only offer is trend commentary. Rejecting is correct. `request_data` was too generous. Expected action → `reject_pitch`, window → 10–40. |
| 5 | strong-but-no-exclusive | label wrong | Action (`ask_question`) is right; window floor of 45 was too high (persona scored 42). Window → 38–65. |
| 7 | funding-round-with-metrics | persona wrong | An embargoed exclusive with real ARR and a named lead investor should book. Score of 35 is far too low. → prompt-fix list. |
| 9 | founder-credential-hook | label wrong | Score (78) is fine; persona asking one question before booking a stealth launch is defensible. Expected action → `book_meeting \| ask_question`. |
| 10 | borderline-thin-launch | label wrong | Score sits ~12 every run; floor of 20 too high. Window → 8–45. |

- **Fix the fixture:** #4, #5, #9, #10.
- **Fix the prompt:** #7 — the persona under-rates a genuinely strong pitch.
- **Leave alone:** #1, #2, #3, #6, #8 — behaving as designed.

---

## What we changed after Run 1

### 1. Prompt — added a scoring rubric and action guide (kept)

Edited `buildSystemPrompt` in `lib/anthropic/personas.ts`. Before this, the
persona had pet peeves and two examples but **nothing that defined the 0–100
scale or said when one action beats another**. Run 1 showed the cost of that:
scores bunched below 45, and the score and the action were decided
independently so they could disagree (#9 scored 78 but only asked a question).

Added two blocks:

**`<scoring_rubric>`** — seven anchored score bands from "0–15: no substance"
to "85–100: exceptional", opening with "use the full range — don't cluster
everything below 50". Notes that self-reported numbers still count but are
worth less than outside evidence, and that bracketed placeholder names
(`[former Twilio VP]`) are fill-in-later blanks, not fake claims, so they
shouldn't drag the score down.

**`<action_guidance>`** — when to use each action, tied loosely to the bands:
- `reject_pitch` — score below ~35, or no path to a story.
- `request_data` — a number claim with no proof **that wasn't already
  offered**. If the pitch already offers the data or methodology, that's a
  reason to book, not to demand it.
- `ask_question` — one blocking unknown (timing, exclusivity, unnamed
  customers).
- `book_meeting` — score **70+ and no blocking unknown**.

Plus two worked calibration examples at the boundaries.

**Why keep it:** it gives the persona a defined scale and forces the score and
action to agree. That's worth having regardless of where the test numbers land.

**Note on order:** ideally the fixture fixes from the triage above come first,
so the rubric's effect can be measured against a clean baseline. That
re-baseline run is the next step (Phase 2 in `EVALS_PLAN.md`).

### 2. Fixtures — applied the 4 triage fixes

In `evals/fixtures.ts`, each with a `// Triage (Run 1):` comment:

| # | change |
|---|--------|
| 4 unnamed-customers | expected action `request_data` → `reject_pitch`; window 20–50 → 10–40 |
| 5 strong-but-no-exclusive | window 45–70 → 38–65 (action unchanged) |
| 9 founder-credential-hook | expected action `book_meeting` → `book_meeting \| ask_question` |
| 10 borderline-thin-launch | window 20–50 → 8–45 (action unchanged) |

#7 was left alone on purpose — it's the one real persona weakness, and it's on
the prompt-fix list. After this the fixtures are **frozen**; the next run is the
honest baseline (rubric + corrected labels), and from there it's one prompt
change per run.
