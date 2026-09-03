# Evals Plan — Gatekeeper AI

## Why

The core of this app is non-deterministic Claude output: which action the
journalist persona picks (`reject_pitch` / `request_data` / `ask_question` /
`book_meeting`) and the 0–100 viability score it assigns. Unit tests can't
assert exact strings against that. This eval suite is how we verify the persona
behaves sensibly and catch regressions when the prompt, tools, or model change.

Small and finished: **10 scenarios**, one runner script, one command. No CI.

## What we check

For each scenario we run one journalist turn and grade:

1. **Action correctness** — the action the journalist picked matches the
   expected action for that scenario. Main metric.
2. **Score bounds** — the `score_pitch` score falls inside the
   `[minScore, maxScore]` window for the scenario.
3. **Persona fidelity** (Phase 3, LLM-as-judge) — a second Claude call rates
   the journalist's critique/question text 1–5 for: specific not generic, in
   character, no corporate cheerleading. Pass = ≥ 3. Advisory only.

**Action accuracy** = how many of the 10 actions matched.
**Score in bounds** = how many of the 10 scores landed in range.
The suite passes if action accuracy ≥ 8/10 AND score in bounds ≥ 8/10. It's a
persona eval, not a unit test — a couple of defensible disagreements per run
are expected.

## The method — how we iterate

The point of the suite is to make prompt changes measurable. That only works if
we change one thing at a time and always compare against a trustworthy baseline.

**The one rule: never change the fixtures and the prompt in the same run.**

1. **Baseline.** Run the suite against the current prompt. Change nothing first.
2. **Triage every failure, in writing.** For each failing scenario ask one
   question: *is the persona's actual behaviour defensible for a ruthless
   journalist?*
   - Yes → our expected label was a bad guess. Fix the fixture.
   - No → the persona is wrong. Add it to a prompt-fix list.
3. **Fix the fixtures, re-run.** Same prompt, corrected labels. This is the
   honest baseline — whatever still fails is a real persona problem.
4. **Freeze the fixtures.** They don't change again during prompt iteration.
   They only change later if we find a genuinely new labelling mistake, and
   that gets its own note in `FINDINGS.md`.
5. **One prompt change per run, with a written hypothesis.** State what you
   expect to improve and why, make the change, run, compare only against the
   last frozen-fixture run. Keep it or revert it.
6. **Repeat step 5** until the suite passes (≥ 8/10 on each metric), or until
   the only remaining failures are real persona limits that are documented.

Every run gets an entry in `evals/FINDINGS.md`: what changed since the last
run, the result, and what we learned.

## Three phases

Each phase is roughly one commit and leaves the suite runnable.

### Phase 1 — deterministic core  ✅ done

- Refactor: `runJournalistTurn(messages)` extracted into `lib/anthropic/turn.ts`
  (the streaming `/api/simulate` route now shares its helpers).
- `evals/fixtures.ts` — the 10 scenarios.
- `evals/run.ts` — runs each scenario, grades action + score, prints the table,
  writes `evals/REPORT.md`, exits non-zero on failure.
- `npm run eval` wired up.

### Phase 2 — honest baseline, then prompt iteration  ✅ done

- Run 1 = baseline. Triaged the failures into "our label was wrong" vs "the
  persona is wrong".
- Fixed the fixture labels and windows (Runs 2 and 2b), froze the fixtures.
- Two prompt changes, one per run: a scoring rubric + action guide, then a
  narrower definition of a "blocking unknown".
- Run 3 passes: 9/10 action, 9/10 score. #7 left as a documented persona
  judgment call. Full history in `FINDINGS.md`.

### Phase 3 — persona judge + writeup

- `evals/judge.ts` — one Claude call that rates the journalist's action text
  1–5 (specific / in character / no cheerleading).
- `run.ts` adds the persona column; pass = ≥ 3, advisory (doesn't change the
  exit code).
- `evals/REPORT.md` gets a short header (date, model, aggregate scores).
- One short paragraph in the README / video notes: what the suite checks and
  how the method turned prompt changes into measurable results.
- Done when: the table has a persona score per row and three consecutive runs
  are green.

## Scenarios

Full `clientNews` and `pitch` text lives in `evals/fixtures.ts`. Summary:

| #  | id                         | shape                                             | expected action              | window |
|----|----------------------------|---------------------------------------------------|------------------------------|--------|
| 1  | empty-buzzwords            | "revolutionary AI platform", zero metrics         | reject_pitch                 | 0–25   |
| 2  | no-why-now                 | real product, no hook or timing                   | reject_pitch                 | 5–30   |
| 3  | vague-traction-claim       | "huge growth", no numbers                         | request_data                 | 15–45  |
| 4  | unnamed-customers          | "used by major banks" — none named                | request_data                 | 20–50  |
| 5  | strong-but-no-exclusive    | solid funding news, exclusivity unclear           | ask_question                 | 45–70  |
| 6  | timing-unclear             | good study results, publish date missing          | ask_question                 | 40–65  |
| 7  | funding-round-with-metrics | $12M Series A, named lead, ARR, embargoed exclusive| book_meeting                 | 65–90  |
| 8  | data-backed-launch         | launch + external benchmark + named design partners| book_meeting                | 65–90  |
| 9  | founder-credential-hook    | ex-regulator founder, concrete "why now"           | book_meeting                 | 60–88  |
| 10 | borderline-thin-launch     | launch with one weak metric — genuinely ambiguous  | reject_pitch \| request_data | 20–50  |

These windows and labels are pre-triage guesses. Phase 2 corrects them.

## Files

```
evals/
  fixtures.ts        # the 10 scenarios
  run.ts             # the runner
  judge.ts           # Phase 3 — LLM-as-judge for persona fidelity
  FINDINGS.md        # committed log — one entry per run
  REPORT.md          # generated each run, git-ignored
```

## Command

```
npm run eval          # tsx --env-file=.env.local evals/run.ts
```

Run manually with `ANTHROPIC_API_KEY` in `.env.local`. Costs ~20 Claude calls
per run (10 turns × 2 calls), plus 10 judge calls once Phase 3 lands — a few
cents.

## Out of scope (deliberately)

- CI integration — it's a demo app; run it by hand before merging prompt changes.
- Evals for `/api/compile-email` and `/api/vet-answers` — same pattern could be
  added later.
- Multi-turn conversations — every scenario is a single opening turn.
