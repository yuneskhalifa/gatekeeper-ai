// Phase 1 eval runner — deterministic core.
//
//   npx tsx --env-file=.env.local evals/run.ts
//
// Runs one journalist turn per scenario and grades action correctness and
// score bounds. Prints a table, writes evals/REPORT.md, exits non-zero if
// action accuracy < 80% or any score is out of bounds.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "@/lib/anthropic/client";
import { runJournalistTurn } from "@/lib/anthropic/turn";
import { scenarios, type Action, type Scenario } from "./fixtures";

const ACTION_ACCURACY_THRESHOLD = 0.8;

function firstUserMessage(s: Scenario): Anthropic.MessageParam[] {
  return [
    {
      role: "user",
      content: `CLIENT'S NEWS:\n${s.clientNews}\n\nDRAFTED PITCH:\n${s.pitch}`,
    },
  ];
}

function actionMatches(expected: Action | Action[], actual: string): boolean {
  return Array.isArray(expected)
    ? expected.includes(actual as Action)
    : expected === actual;
}

interface Row {
  id: string;
  expectedAction: string;
  actualAction: string;
  actionOk: boolean;
  score: number;
  window: string;
  scoreOk: boolean;
  error?: string;
}

async function grade(s: Scenario): Promise<Row> {
  const expectedAction = Array.isArray(s.expectedAction)
    ? s.expectedAction.join(" | ")
    : s.expectedAction;
  const window = `${s.minScore}-${s.maxScore}`;
  try {
    const turn = await runJournalistTurn(firstUserMessage(s));
    const actualAction = turn.action.name;
    const score = turn.score.score;
    return {
      id: s.id,
      expectedAction,
      actualAction,
      actionOk: actionMatches(s.expectedAction, actualAction),
      score,
      window,
      scoreOk: score >= s.minScore && score <= s.maxScore,
    };
  } catch (err) {
    return {
      id: s.id,
      expectedAction,
      actualAction: "—",
      actionOk: false,
      score: NaN,
      window,
      scoreOk: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function table(rows: Row[]): string {
  const mark = (ok: boolean) => (ok ? "ok " : "BAD");
  const header = `${pad("#", 3)} ${pad("id", 27)} ${pad("action", 15)} ${pad(
    "",
    3
  )} ${pad("expected", 24)} ${pad("score", 5)} ${pad("", 3)} ${pad(
    "window",
    8
  )} result`;
  const lines = rows.map((r, i) => {
    if (r.error) {
      return `${pad(String(i + 1), 3)} ${pad(r.id, 27)} FAIL — ${r.error}`;
    }
    return [
      pad(String(i + 1), 3),
      pad(r.id, 27),
      pad(r.actualAction, 15),
      mark(r.actionOk),
      pad(r.expectedAction, 24),
      pad(String(r.score), 5),
      mark(r.scoreOk),
      pad(r.window, 8),
      r.actionOk && r.scoreOk ? "PASS" : "FAIL",
    ].join(" ");
  });
  return [header, ...lines].join("\n");
}

async function main() {
  console.log(`Running ${scenarios.length} scenarios against ${MODEL}...\n`);
  const rows: Row[] = [];
  for (const s of scenarios) {
    process.stdout.write(`  ${s.id} ... `);
    const row = await grade(s);
    rows.push(row);
    console.log(row.error ? "error" : row.actionOk && row.scoreOk ? "pass" : "fail");
  }

  const actionHits = rows.filter((r) => r.actionOk).length;
  const scoreHits = rows.filter((r) => r.scoreOk).length;
  const actionAccuracy = actionHits / rows.length;

  const summary = [
    "",
    table(rows),
    "",
    `Action accuracy:  ${actionHits}/${rows.length}  (${Math.round(
      actionAccuracy * 100
    )}%)`,
    `Score in-bounds:  ${scoreHits}/${rows.length}`,
  ].join("\n");
  console.log(summary);

  const report = [
    "# Eval Report",
    "",
    `- Date: ${new Date().toISOString()}`,
    `- Model: ${MODEL}`,
    `- Action accuracy: ${actionHits}/${rows.length} (${Math.round(
      actionAccuracy * 100
    )}%)`,
    `- Score in-bounds: ${scoreHits}/${rows.length}`,
    "",
    "```",
    table(rows),
    "```",
    "",
  ].join("\n");
  writeFileSync(join(process.cwd(), "evals/REPORT.md"), report);

  const pass = actionAccuracy >= ACTION_ACCURACY_THRESHOLD && scoreHits === rows.length;
  if (!pass) {
    console.log(
      `\nFAIL — need action accuracy >= ${
        ACTION_ACCURACY_THRESHOLD * 100
      }% and all scores in bounds.`
    );
    process.exit(1);
  }
  console.log("\nPASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
