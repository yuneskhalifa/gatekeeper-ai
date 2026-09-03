# Eval Findings

Durable write-ups of what each eval run revealed about the persona.
`evals/REPORT.md` holds the raw generated table and is overwritten every run;
this file is committed and keeps the full record.

---

## Run 1 — 2026-09-03, `claude-sonnet-4-5` (Phase 1: action + score grading only)

- Date: 2026-09-03T08:41:38.085Z
- Model: claude-sonnet-4-5
- Action accuracy: 7/10 (70%)
- Score in-bounds: 6/10
- Suite result: FAIL (needs action accuracy ≥ 80% and all scores in bounds)

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

### How the system behaved on the first run

The persona is internally consistent and clearly harsher than the fixtures
assumed — which is the useful finding, not a bug in the runner.

**The extremes are solid.** Both pure-fluff pitches (`empty-buzzwords`,
`no-why-now`) were rejected with single-digit scores, and the one pitch that
carried an independent benchmark plus named, on-the-record design partners
(`data-backed-launch`) was the only clean `book_meeting` at 82. The journalist
rewards verifiable third-party evidence and punishes adjectives, exactly as
intended.

**The persona defaults to `ask_question` in the whole upper-middle band.**
Three scenarios I expected to clear as `book_meeting` —
`funding-round-with-metrics` (offered as an embargoed exclusive with ARR and a
named lead), `founder-credential-hook` (ex-regulator founder, 8 named
customers), and by extension `strong-but-no-exclusive` — all came back as a
gating question instead. The journalist wants one more thing confirmed before
committing, even when the pitch already contains real substance. Scores tracked
this: 35 for the funding round, 78 for the founder hook — it sees the funding
round as genuinely weaker despite the metrics, which is a defensible read (the
angel names were bracketed placeholders, not real).

**On thin-but-not-empty pitches it reaches for `reject_pitch`, not
`request_data`.** `unnamed-customers` (a plausible claim with NDA'd customers)
and `borderline-thin-launch` were both rejected rather than sent back for
evidence. The persona appears to treat "no evidence offered up front" as
disqualifying rather than as something worth asking for.

**Scores run low across the board.** Six of ten landed below the expected
window, several by only a few points (42 vs. a 45 floor, 18 vs. a 20 floor).
The persona's 0–100 scale is compressed toward the bottom — a "pretty good"
pitch sits around 40, not 60.

**Takeaway for Phase 3:** the score windows need to be re-centred roughly
10–15 points lower, and the `book_meeting` / `ask_question` and
`request_data` / `reject_pitch` expectations in three or four fixtures should be
relaxed to match how this persona actually adjudicates. Whether the persona
*should* be this reluctant to book a meeting is a separate product question
worth raising with the prompt.

### Per-scenario detail

| #  | id                         | expected action              | actual action | window | score | verdict                 |
|----|----------------------------|------------------------------|---------------|--------|-------|-------------------------|
| 1  | empty-buzzwords            | reject_pitch                 | reject_pitch  | 0–25   | 8     | PASS                    |
| 2  | no-why-now                 | reject_pitch                 | reject_pitch  | 5–30   | 8     | PASS                    |
| 3  | vague-traction-claim       | request_data                 | request_data  | 15–45  | 15    | PASS                    |
| 4  | unnamed-customers          | request_data                 | reject_pitch  | 20–50  | 18    | FAIL — action + score   |
| 5  | strong-but-no-exclusive    | ask_question                 | ask_question  | 45–70  | 42    | FAIL — score 3 pts low  |
| 6  | timing-unclear             | ask_question                 | ask_question  | 40–65  | 42    | PASS                    |
| 7  | funding-round-with-metrics | book_meeting                 | ask_question  | 65–90  | 35    | FAIL — action + score   |
| 8  | data-backed-launch         | book_meeting                 | book_meeting  | 65–90  | 82    | PASS                    |
| 9  | founder-credential-hook    | book_meeting                 | ask_question  | 60–88  | 78    | FAIL — action only      |
| 10 | borderline-thin-launch     | reject_pitch \| request_data | reject_pitch  | 20–50  | 12    | FAIL — score 8 pts low  |

### What is a real problem vs. a fixture problem

- **Fixture problem (fix in Phase 3):** #5, #9, #10 — the action is a
  reasonable call by the persona; only my expected window or expected action
  was miscalibrated.
- **Worth discussing with the prompt:** #4 and #7 — rejecting a plausible
  NDA-backed customer claim outright (instead of `request_data`), and
  declining to book an embargoed exclusive with real ARR and a named lead
  investor. Both are within a strict journalist's rights, but if the product
  goal is to reward consultants who bring a genuinely strong pitch, the
  persona may be too quick to stall.
- **Not a problem:** #1, #2, #3, #6, #8 — behaving exactly as designed.
