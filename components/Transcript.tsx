import { ScoreGauge } from "@/components/ScoreGauge";
import { ToolActionBadge } from "@/components/ToolActionBadge";

export interface Turn {
  pitch: string;
  actionRaw: string;
  action?: { name: string; input: Record<string, unknown> };
  scoreRaw: string;
  score?: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    verdict: string;
  };
  status: "action" | "score" | "done";
  error?: string;
}

function actionText(action: Turn["action"]): string {
  if (!action) return "";
  const { name, input } = action;
  switch (name) {
    case "reject_pitch":
      return String(input.critique ?? "");
    case "request_data":
      return String(input.request ?? "");
    case "ask_question":
      return String(input.question ?? "");
    case "book_meeting": {
      const times = Array.isArray(input.proposedTimes)
        ? (input.proposedTimes as string[]).join(", ")
        : "";
      const notes = input.notes ? ` (${input.notes})` : "";
      return `Proposed times: ${times}${notes}`;
    }
    default:
      return "";
  }
}

export function Transcript({ turns }: { turns: Turn[] }) {
  if (turns.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Paste a pitch below to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
      {turns.map((turn, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground whitespace-pre-wrap">
            {turn.pitch}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3">
            {turn.action ? (
              <div className="flex flex-col gap-2">
                <ToolActionBadge action={turn.action.name} />
                <p className="text-sm">{actionText(turn.action)}</p>
              </div>
            ) : (
              <p className="animate-pulse font-mono text-xs text-muted-foreground">
                {turn.actionRaw ? "reading pitch..." : "Marcus is reading..."}
              </p>
            )}

            {turn.score ? (
              <ScoreGauge
                score={turn.score.score}
                verdict={turn.score.verdict}
                strengths={turn.score.strengths}
                weaknesses={turn.score.weaknesses}
              />
            ) : turn.status !== "action" && !turn.error ? (
              <p className="animate-pulse font-mono text-xs text-muted-foreground">
                scoring...
              </p>
            ) : null}

            {turn.error && (
              <p className="text-sm text-destructive">{turn.error}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
