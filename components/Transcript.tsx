"use client";

import { ArrowRight } from "lucide-react";
import type { PitchEmailDraft } from "@/lib/anthropic/compose";
import { yunesKhalifa } from "@/lib/anthropic/personas";
import { ScoreGauge } from "@/components/ScoreGauge";
import { VerdictStamp } from "@/components/ToolActionBadge";
import { PitchEmail } from "@/components/PitchEmail";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export type EmailState =
  | { status: "pending" }
  | { status: "done"; draft: PitchEmailDraft }
  | { status: "error"; message: string };

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
  // Milestone 2 — the compiled send-ready email, only ever set on a
  // book_meeting turn once the consultant asks for it.
  email?: EmailState;
}

const ACCENT_BORDER: Record<string, string> = {
  reject_pitch: "border-l-destructive",
  request_data: "border-l-muted-foreground/50",
  ask_question: "border-l-muted-foreground/50",
  book_meeting: "border-l-primary",
};

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

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
      <p className="font-heading text-2xl font-medium italic text-foreground/90">
        Nobody&apos;s pitched him yet today.
      </p>
      <p className="text-sm text-muted-foreground">
        Paste the client&apos;s news and your drafted pitch below.
      </p>
    </div>
  );
}

function CompileEmailSection({
  turn,
  originalPitch,
  onCompile,
}: {
  turn: Turn;
  originalPitch: string;
  onCompile: () => void;
}) {
  const firstName = yunesKhalifa.name.split(" ")[0];

  if (turn.email?.status === "done") {
    return (
      <div className="pl-11">
        <PitchEmail draft={turn.email.draft} originalPitch={originalPitch} />
      </div>
    );
  }

  if (turn.email?.status === "pending") {
    return (
      <div className="pl-11">
        <p className="animate-pulse font-mono text-xs text-muted-foreground">
          Compiling the send-ready pitch...
        </p>
      </div>
    );
  }

  const isRetry = turn.email?.status === "error";

  return (
    <div className="flex flex-col gap-1.5 pl-11">
      <button
        type="button"
        onClick={onCompile}
        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {isRetry
              ? "Retry compiling the send-ready pitch"
              : "Your pitch cleared the gatekeeper."}
          </span>
          <span className="text-xs text-muted-foreground">
            Compile it into the email you send {firstName}.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs font-semibold text-primary">
          Compile
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
      {isRetry && turn.email?.status === "error" && (
        <p className="text-xs text-destructive">{turn.email.message}</p>
      )}
    </div>
  );
}

export function Transcript({
  turns,
  onCompileEmail,
}: {
  turns: Turn[];
  onCompileEmail: (turnIndex: number) => void;
}) {
  if (turns.length === 0) {
    return <EmptyState />;
  }

  const originalPitch = turns[0].pitch;

  return (
    <div className="flex flex-col gap-8">
      {turns.map((turn, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="flex justify-end">
            <div className="max-w-[38rem] rounded-2xl rounded-br-sm bg-secondary px-4 py-3 text-sm whitespace-pre-wrap text-secondary-foreground">
              {turn.pitch}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Avatar className="mt-0.5 shrink-0">
              <AvatarFallback className="bg-primary/15 font-mono text-[10px] font-semibold text-primary">
                YK
              </AvatarFallback>
            </Avatar>

            <div
              className={`flex max-w-[38rem] flex-col gap-3 rounded-2xl rounded-bl-sm border-l-4 bg-card px-4 py-3 ${
                turn.action ? ACCENT_BORDER[turn.action.name] : "border-l-border"
              }`}
            >
              {turn.action ? (
                <div className="flex flex-col gap-2">
                  <VerdictStamp action={turn.action.name} />
                  <p className="text-sm leading-relaxed">
                    {actionText(turn.action)}
                  </p>
                </div>
              ) : (
                <p className="animate-pulse font-mono text-xs text-muted-foreground">
                  Yunes is reading...
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

          {turn.action?.name === "book_meeting" &&
            turn.score &&
            (i === turns.length - 1 || turn.email) && (
              <CompileEmailSection
                turn={turn}
                originalPitch={originalPitch}
                onCompile={() => onCompileEmail(i)}
              />
            )}
        </div>
      ))}
    </div>
  );
}
