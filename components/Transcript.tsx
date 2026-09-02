"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { PitchEmailDraft } from "@/lib/anthropic/compose";
import { yunesKhalifa } from "@/lib/anthropic/personas";
import { ScoreGauge } from "@/components/ScoreGauge";
import { VerdictStamp } from "@/components/ToolActionBadge";
import { PitchEmail } from "@/components/PitchEmail";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type WeaknessResponse = { weakness: string; answer: string };

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

function WeaknessForm({
  weaknesses,
  onCancel,
  onSubmit,
}: {
  weaknesses: string[];
  onCancel: () => void;
  onSubmit: (responses: WeaknessResponse[]) => void;
}) {
  const [answers, setAnswers] = useState<string[]>(() =>
    weaknesses.map(() => "")
  );
  // rowIndex -> issue, for answers the vet step sent back as not usable
  const [flags, setFlags] = useState<Record<number, string>>({});
  const [vetting, setVetting] = useState(false);
  const [vetError, setVetError] = useState<string | null>(null);
  const firstName = yunesKhalifa.name.split(" ")[0];
  const answeredCount = answers.filter((a) => a.trim().length > 0).length;

  function setAnswer(i: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
    // editing a flagged answer clears its stale flag until it's re-checked
    setFlags((prev) => {
      if (!(i in prev)) return prev;
      const next = { ...prev };
      delete next[i];
      return next;
    });
  }

  async function submit() {
    const responses = weaknesses
      .map((weakness, i) => ({ weakness, answer: answers[i].trim() }))
      .filter((r) => r.answer.length > 0);

    if (responses.length === 0) {
      onSubmit([]);
      return;
    }

    const withIndex = weaknesses
      .map((weakness, index) => ({ index, weakness, answer: answers[index].trim() }))
      .filter((r) => r.answer.length > 0);

    setVetting(true);
    setVetError(null);
    try {
      const res = await fetch("/api/vet-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: withIndex }),
      });
      const data = await res.json();

      if (res.ok && Array.isArray(data.verdicts)) {
        const bad: Record<number, string> = {};
        for (const v of data.verdicts as {
          index: number;
          usable: boolean;
          issue: string;
        }[]) {
          if (!v.usable) {
            bad[v.index] = v.issue || "This answer doesn't hold up — revise it or skip it.";
          }
        }
        if (Object.keys(bad).length > 0) {
          setFlags(bad);
          setVetting(false);
          return;
        }
      } else if (!res.ok) {
        // vetting failed — don't block the consultant, just note it
        setVetError(data.error ?? "Couldn't check the answers.");
      }
    } catch {
      setVetError("Couldn't check the answers — compiling anyway.");
    }

    setVetting(false);
    onSubmit(responses);
  }

  const flaggedCount = Object.keys(flags).length;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">
          Answer what {firstName} still flagged
        </span>
        <span className="text-xs text-muted-foreground">
          {flaggedCount > 0
            ? `${flaggedCount} answer${
                flaggedCount === 1 ? "" : "s"
              } didn't hold up — revise ${
                flaggedCount === 1 ? "it" : "them"
              } or clear the box to skip, then compile again.`
            : `${firstName} booked the meeting, but the score left these gaps. Fill in what you can — each answer gets folded into the email. Leave a box blank to skip that point.`}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {weaknesses.map((w, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <span className="flex gap-1.5 text-xs leading-relaxed text-foreground/80">
              <span className="text-destructive">−</span>
              <span>{w}</span>
            </span>
            <Textarea
              value={answers[i]}
              onChange={(e) => setAnswer(i, e.target.value)}
              disabled={vetting}
              placeholder="Your answer (or leave blank to skip)"
              className={
                flags[i]
                  ? "min-h-[3.5rem] resize-y border-destructive text-[13px] leading-relaxed"
                  : "min-h-[3.5rem] resize-y text-[13px] leading-relaxed"
              }
              aria-label={`Answer to: ${w}`}
            />
            {flags[i] && (
              <span className="flex gap-1.5 text-[11px] leading-relaxed text-destructive">
                <span aria-hidden>⚠</span>
                <span>{flags[i]}</span>
              </span>
            )}
          </div>
        ))}
      </div>

      {vetError && (
        <p className="text-[11px] text-muted-foreground">{vetError}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        <Button size="sm" onClick={submit} disabled={vetting}>
          {vetting
            ? "Checking answers..."
            : flaggedCount > 0
              ? "Re-check & compile"
              : answeredCount > 0
                ? `Compile with ${answeredCount} answer${answeredCount === 1 ? "" : "s"}`
                : "Compile without answering"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={vetting}
        >
          Cancel
        </Button>
      </div>
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
  onCompile: (responses?: WeaknessResponse[]) => void;
}) {
  const firstName = yunesKhalifa.name.split(" ")[0];
  const [prompting, setPrompting] = useState(false);
  const weaknesses = turn.score?.weaknesses ?? [];

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

  if (prompting) {
    return (
      <div className="flex flex-col gap-1.5 pl-11">
        <WeaknessForm
          weaknesses={weaknesses}
          onCancel={() => setPrompting(false)}
          onSubmit={(responses) => {
            setPrompting(false);
            onCompile(responses);
          }}
        />
        {isRetry && turn.email?.status === "error" && (
          <p className="text-xs text-destructive">{turn.email.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 pl-11">
      <button
        type="button"
        onClick={() => (weaknesses.length > 0 ? setPrompting(true) : onCompile())}
        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {isRetry
              ? "Retry compiling the send-ready pitch"
              : "Your pitch cleared the gatekeeper."}
          </span>
          <span className="text-xs text-muted-foreground">
            {weaknesses.length > 0
              ? `Answer the ${weaknesses.length} gap${
                  weaknesses.length === 1 ? "" : "s"
                } ${firstName} flagged, then compile the email.`
              : `Compile it into the email you send ${firstName}.`}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs font-semibold text-primary">
          {weaknesses.length > 0 ? "Strengthen & compile" : "Compile"}
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
  onCompileEmail: (
    turnIndex: number,
    weaknessResponses?: WeaknessResponse[]
  ) => void;
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
                onCompile={(responses) => onCompileEmail(i, responses)}
              />
            )}
        </div>
      ))}
    </div>
  );
}
