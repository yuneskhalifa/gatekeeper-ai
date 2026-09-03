# Evals Plan — Gatekeeper AI

## Why

The core of this app is non-deterministic Claude output: which action the
journalist persona picks (`reject_pitch` / `request_data` / `ask_question` /
`book_meeting`) and the 0–100 viability score it assigns. Unit tests can't
assert exact strings against that. This eval suite is how we verify the
persona behaves sensibly and catch regressions when the prompt, tools, or
model change.

Small and finished: **10 scenarios**, one runner script, one command. No CI.

## Three phases

Each phase is one commit and leaves the suite runnable.

### Phase 1 — deterministic core
- Refactor: extract `runJournalistTurn(messages)` into `lib/anthropic/turn.ts`
  (see below), route handler keeps its streaming wrapper.
- `evals/fixtures.ts` — the 10 scenarios (full text below).
- `evals/run.ts` — loop fixtures, call `runJournalistTurn`, grade **action
  correctness** and **score bounds** only. Print the table, write `REPORT.md`,
  exit non-zero on failure.
- `npm run eval` wired up.
- Done when: `npm run eval` prints a pass/fail table for all 10.

### Phase 2 — persona judge
- `evals/judge.ts` — one Claude call that rates the journalist's action text
  1–5 (specific not generic, in character, no cheerleading).
- `run.ts` adds the persona column; pass = ≥ 3. Does not affect exit code
  (advisory), so a flaky judge never blocks a run.
- Done when: the table has a persona score per row.

### Phase 3 — polish
- Tune the 10 score windows against 2–3 real runs so they're tight but not
  flaky.
- `REPORT.md` gets a short header (date, model id, aggregate scores).
- One paragraph in `README` / video notes: what the suite checks and how to
  run it.
- Done when: three consecutive runs are green with no window edits.

## What we check

For each scenario we run one journalist turn and grade three things:

1. **Action correctness** — the tool the journalist picked matches the
   expected action for that scenario. This is the main metric.
2. **Score bounds** — the `score_pitch` score falls inside the
   `[minScore, maxScore]` window we set for the scenario (e.g. a pitch with
   no news value must never score above ~30; a strong funding story must
   never score below ~65).
3. **Persona fidelity** (LLM-as-judge) — a second Claude call rates the
   journalist's critique/question text 1–5 on: specific not generic, in
   character (cynical, blunt), no corporate cheerleading. Pass = ≥ 3.

## Scenarios (10)

Hand-written fixtures covering the full action range plus the ambiguous
middle. Each is `{ id, clientNews, pitch, expectedAction, minScore, maxScore }`.

| #  | id                        | Shape                                              | Expected action  | Score window |
|----|---------------------------|----------------------------------------------------|------------------|--------------|
| 1  | empty-buzzwords           | Vague "revolutionary AI platform", zero metrics    | reject_pitch     | 0–25         |
| 2  | no-why-now                | Real product, but no hook or timing                | reject_pitch     | 5–30         |
| 3  | vague-traction-claim      | Claims "huge growth", no numbers                   | request_data     | 15–45        |
| 4  | unnamed-customers         | "Used by major banks" — none named                 | request_data     | 20–50        |
| 5  | strong-but-no-exclusive   | Solid funding news, unclear if offered exclusively | ask_question     | 45–70        |
| 6  | timing-unclear            | Good study results, embargo/publish date missing   | ask_question     | 40–65        |
| 7  | funding-round-with-metrics| $12M Series A, named lead investor, ARR figure     | book_meeting     | 65–90        |
| 8  | data-backed-launch        | Launch + third-party benchmark + named design partner | book_meeting  | 65–90        |
| 9  | founder-credential-hook   | Ex-regulator founder, concrete "why now" tie-in    | book_meeting     | 60–88        |
| 10 | borderline-thin-launch    | Launch with one weak metric — genuinely ambiguous  | reject_pitch OR request_data | 20–50 |

Scenario 10 accepts either action (list in `expectedAction` as an array) —
it's there to document a known grey zone, not to fail the run.

## The exact 10 scenarios

Verbatim `clientNews` and `pitch` for `evals/fixtures.ts`.

---

### 1. empty-buzzwords → `reject_pitch` (0–25)

**clientNews:** Nexora, a two-person startup, has launched what it calls "a
revolutionary AI-native platform that reimagines how teams work." No users, no
revenue, no launch date beyond "now."

**pitch:** Hi — I'm working with Nexora, a game-changing startup that's
disrupting the future of work with a revolutionary AI-native platform. Their
visionary founders are reimagining productivity from the ground up. I'd love to
set up a call to tell you more about this exciting journey. Are you free this
week?

---

### 2. no-why-now → `reject_pitch` (5–30)

**clientNews:** Brightlane, a project-management SaaS company founded in 2019,
has a stable product with about 4,000 paying customers. Nothing new has shipped
recently; there is no announcement, funding, or milestone attached.

**pitch:** I represent Brightlane, a well-established project-management tool
loved by thousands of teams. The founders are available for interviews and can
speak to productivity, remote work, and startup life. Would you be interested in
a conversation?

---

### 3. vague-traction-claim → `request_data` (15–45)

**clientNews:** Cadence, a fintech app for freelancers, says it has seen "huge
growth" over the last year and is "one of the fastest-growing apps in its
category." It will not share specific numbers in the pitch.

**pitch:** Cadence has exploded in popularity — we've seen massive user growth
and incredible engagement over the past 12 months, making us one of the
fastest-growing finance apps for freelancers. The founder would love to talk
about what's driving this momentum. Can we find time this week?

---

### 4. unnamed-customers → `request_data` (20–50)

**clientNews:** Verilock, a security startup, claims its software is "used by
several of the largest banks in Europe" but has signed NDAs and will not name
any customer publicly.

**pitch:** Verilock's fraud-detection engine is now used by several of the
biggest banks in Europe to stop account-takeover attacks. We can't name them
publicly, but the results have been significant. Our CEO is available to discuss
the state of bank fraud in 2026. Interested?

---

### 5. strong-but-no-exclusive → `ask_question` (45–70)

**clientNews:** Loomwork has raised a $9M Series A led by Northgate Ventures,
bringing total funding to $14M. ARR is $2.1M, up from $600K a year ago. The
pitch does not say whether the story is being offered exclusively or pitched
broadly.

**pitch:** Loomwork has closed a $9M Series A led by Northgate Ventures (total
raised: $14M). ARR grew from $600K to $2.1M in the last year. The founder, a
former Stripe engineer, can walk you through how they got there and where the
money is going. Would you like to cover this?

---

### 6. timing-unclear → `ask_question` (40–65)

**clientNews:** Mediva, a digital-health company, has results from a
peer-reviewed study showing its app reduced hospital readmissions by 22% across
1,400 patients. The publication date of the study and any embargo are not
mentioned.

**pitch:** A new peer-reviewed study of 1,400 patients found that Mediva's app
cut 30-day hospital readmissions by 22%. The lead researcher and our chief
medical officer are both available to comment. Let me know if you'd like the
data.

---

### 7. funding-round-with-metrics → `book_meeting` (65–90)

**clientNews:** Tandem has raised a $12M Series A led by Basis Set Ventures,
with participation from two named angels (a former Twilio VP and the founder of
Segment). ARR is $3.4M, growing 15% month-over-month. The round is being offered
to this journalist exclusively, embargoed until next Tuesday 6am ET.

**pitch:** Offering you an exclusive on this, embargoed to Tuesday 6am ET:
Tandem has raised a $12M Series A led by Basis Set Ventures, with angels
including [former Twilio VP] and [Segment founder]. ARR is $3.4M and growing 15%
MoM. The two co-founders are available for a call today or tomorrow. Full data
room and cap-table summary ready to share under embargo.

---

### 8. data-backed-launch → `book_meeting` (65–90)

**clientNews:** Kernel is launching an open-source model-evaluation tool. An
independent benchmark from a named university lab shows it catches 31% more
regressions than the current leading tool. Three named design partners
(mid-size AI companies) are on the record with quotes.

**pitch:** Kernel launches Thursday: an open-source eval tool that, in an
independent benchmark run by [University] ML lab, caught 31% more model
regressions than [incumbent tool]. Three design partners — [Company A], [Company
B], [Company C] — are on the record. Happy to get you the benchmark methodology
and put you in touch with any of the partners before Thursday.

---

### 9. founder-credential-hook → `book_meeting` (60–88)

**clientNews:** Sentinel, a compliance-automation startup, is founded by a
former enforcement director at a national financial regulator. It is launching
the week that a major new financial regulation takes effect, and has 8 named
paying customers who must comply with that rule.

**pitch:** Sentinel comes out of stealth next week — the same week [Regulation]
takes effect. Its founder spent six years as an enforcement director at
[Regulator] and built Sentinel to automate exactly the compliance work she used
to penalize firms for failing. Eight paying customers already, all named and
referenceable. She can speak to what the new rule means for the industry.
Interview this week?

---

### 10. borderline-thin-launch → `reject_pitch` OR `request_data` (20–50)

**clientNews:** Plotline, a note-taking app, is launching version 2.0. The only
metric offered is "over 50,000 downloads since our beta started." No revenue,
retention, or growth-rate figures. No competitive hook beyond a redesigned UI.

**pitch:** Plotline 2.0 is here — a completely redesigned note-taking app that's
already passed 50,000 downloads since our beta. The founder can talk about
building in public and designing for focus. Would this be a fit for your
readers?

---

## Files

```
evals/
  fixtures.ts        # the 10 scenarios as a typed array
  run.ts             # the runner
  judge.ts           # LLM-as-judge for persona fidelity
  REPORT.md          # generated on each run (git-ignored)
```

## Small prerequisite refactor

The two-call sequence (force one action tool, then `score_pitch`) currently
lives inline in `app/api/simulate/route.ts`. Extract the non-streaming core
into `lib/anthropic/turn.ts`:

```ts
runJournalistTurn(messages): Promise<{
  action: { name: string; input: unknown };
  score: { score: number; strengths: string[]; weaknesses: string[] };
}>
```

The route handler keeps its streaming wrapper; the eval runner calls
`runJournalistTurn` directly. This also tidies the route.

## The runner (`run.ts`)

1. Load `fixtures.ts`.
2. For each scenario: build the opening `messages` array from `clientNews` +
   `pitch`, call `runJournalistTurn(messages)`.
3. Grade:
   - action: `actual === expected` (or `expected.includes(actual)` for arrays)
   - score: `minScore <= actual <= maxScore`
   - persona: `judge(actionText) >= 3`
4. Print a table to stdout and write `evals/REPORT.md`:

```
#   id                          action              score        persona   result
1   empty-buzzwords             reject_pitch ✓       11 ✓         5 ✓       PASS
5   strong-but-no-exclusive     ask_question ✓       58 ✓         4 ✓       PASS
7   funding-round-with-metrics  request_data ✗       62 ✓         4 ✓       FAIL
...
Action accuracy:  8/10  (80%)
Score in-bounds:  10/10
Persona pass:     10/10
```

5. Exit non-zero if action accuracy < 80% or any score is out of bounds, so
   the run has a clear pass/fail even though nothing gates on it automatically.

## Command

Add to `package.json`:

```
"eval": "tsx evals/run.ts"
```

Run manually with `ANTHROPIC_API_KEY` set. Costs ~20 Claude calls
(10 turns × 2 calls) plus 10 judge calls per run — a few cents.

## Out of scope (deliberately)

- CI integration — it's a demo app; run it by hand before merging prompt changes.
- Evals for `/api/compile-email` and `/api/vet-answers` — same pattern could be
  added later; not needed to demonstrate the approach.
- Multi-turn conversations — every scenario is a single opening turn.
