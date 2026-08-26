"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Copy,
  Mail,
  Paperclip,
  Sparkles,
} from "lucide-react";
import type { PitchEmailDraft } from "@/lib/anthropic/compose";
import { yunesKhalifa } from "@/lib/anthropic/personas";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { VerdictStamp } from "@/components/ToolActionBadge";
import { cn } from "@/lib/utils";

const MERGE_FIELD = /\[\[.+?\]\]/g;

// Renders text with [[merge fields]] visually flagged — used in the read-only
// "after" view so the consultant can see at a glance what still needs filling.
function withMergeFields(text: string): ReactNode[] {
  return text.split(/(\[\[.+?\]\])/g).map((chunk, i) =>
    /^\[\[.+\]\]$/.test(chunk) ? (
      <mark
        key={i}
        className="rounded-sm bg-primary/25 px-1 font-medium text-foreground"
      >
        {chunk}
      </mark>
    ) : (
      <span key={i}>{chunk}</span>
    )
  );
}

function CheckItem({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <li>
      <button
        type="button"
        onClick={() => setDone((d) => !d)}
        className="flex w-full items-start gap-2 text-left"
      >
        <span
          className={cn(
            "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border"
          )}
        >
          {done && <Check className="size-2.5" strokeWidth={3} />}
        </span>
        <span
          className={cn(
            "text-xs leading-relaxed",
            done ? "text-muted-foreground line-through" : "text-foreground/80"
          )}
        >
          {children}
        </span>
      </button>
    </li>
  );
}

function SectionLabel({
  icon,
  children,
  tone = "muted",
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "muted" | "primary";
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase",
        tone === "primary" ? "text-primary" : "text-muted-foreground"
      )}
    >
      {icon}
      {children}
    </p>
  );
}

// --- "Run it back past the journalist" ------------------------------------
// Sends the compiled (and possibly edited) email back through the same
// journalist persona as a cold read — the gatekeeper vets the final draft too.

type SimAction = { name: string; input: Record<string, unknown> };

type GateCheck =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; action: SimAction; score?: { score: number; verdict: string } }
  | { status: "error"; message: string };

type SimEvent =
  | { type: "action"; action: SimAction }
  | {
      type: "score";
      score: {
        score: number;
        strengths: string[];
        weaknesses: string[];
        verdict: string;
      };
    }
  | { type: "error"; message: string }
  | {
      type: "action_start" | "action_delta" | "score_start" | "score_delta" | "done";
      [key: string]: unknown;
    };

function actionSummary(action: SimAction): string {
  const { name, input } = action;
  if (name === "reject_pitch") return String(input.critique ?? "");
  if (name === "request_data") return String(input.request ?? "");
  if (name === "ask_question") return String(input.question ?? "");
  if (name === "book_meeting")
    return String(input.notes ?? "Would take the meeting.");
  return "";
}

export function PitchEmail({
  draft,
  originalPitch,
}: {
  draft: PitchEmailDraft;
  originalPitch: string;
}) {
  const firstName = yunesKhalifa.name.split(" ")[0];

  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);
  const [check, setCheck] = useState<GateCheck>({ status: "idle" });

  const mergeFieldCount = useMemo(
    () => (`${subject}\n${body}`.match(MERGE_FIELD) ?? []).length,
    [subject, body]
  );

  const mailto = `mailto:?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — no-op, the mailto link is the fallback
    }
  }

  async function runItBack() {
    setCheck({ status: "running" });
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `[Cold outreach email — react as if this just landed in your inbox from a PR contact you don't know.]\n\nSubject: ${subject}\n\n${body}`,
            },
          ],
        }),
      });

      if (!res.body) {
        setCheck({ status: "error", message: "No response from the journalist." });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let action: SimAction | undefined;
      let score: { score: number; verdict: string } | undefined;
      let error: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data: ")) continue;
          const event: SimEvent = JSON.parse(line.slice("data: ".length));
          if (event.type === "action") action = event.action;
          else if (event.type === "score")
            score = { score: event.score.score, verdict: event.score.verdict };
          else if (event.type === "error") error = event.message;
        }
      }

      if (error) setCheck({ status: "error", message: error });
      else if (action) setCheck({ status: "done", action, score });
      else setCheck({ status: "error", message: "The journalist didn't respond." });
    } catch {
      setCheck({
        status: "error",
        message: "Something went wrong running it back.",
      });
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 mt-3 w-full rounded-2xl border border-primary/30 bg-card duration-300">
      <div className="border-b border-border/60 px-4 py-3">
        <span className="inline-block -rotate-2 rounded-sm border-2 border-primary px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-primary uppercase">
          Send-Ready Pitch
        </span>
      </div>

      {draft.simulationEdits.length > 0 && (
        <div className="border-b border-border/60 bg-primary/[0.03] px-4 py-3">
          <SectionLabel icon={<Sparkles className="size-3" />} tone="primary">
            What the simulation changed
          </SectionLabel>
          <ul className="mt-2 flex flex-col gap-1.5">
            {draft.simulationEdits.map((edit, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs leading-relaxed text-foreground/80"
              >
                <ArrowRight className="mt-0.5 size-3 shrink-0 text-primary" />
                <span>{edit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Tabs defaultValue="email" className="p-4">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="diff">Before / After</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="flex flex-col gap-3">
          <div className="flex flex-col font-mono text-xs">
            <div className="flex gap-2 border-b border-border/40 py-1.5">
              <span className="w-16 shrink-0 text-muted-foreground">To</span>
              <span className="text-foreground/80">
                {yunesKhalifa.name} &lt;
                <mark className="rounded-sm bg-primary/25 px-1 font-medium text-foreground">
                  [[ journalist email ]]
                </mark>
                &gt;
              </span>
            </div>
            <div className="flex items-center gap-2 border-b border-border/40">
              <span className="w-16 shrink-0 text-muted-foreground">
                Subject
              </span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-transparent py-2 text-sm text-foreground outline-none"
                aria-label="Email subject"
              />
            </div>
          </div>

          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[16rem] resize-y font-mono text-[13px] leading-relaxed"
            aria-label="Email body"
          />

          {mergeFieldCount > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {mergeFieldCount}{" "}
              <span className="text-primary">[[merge field]]</span>
              {mergeFieldCount === 1 ? "" : "s"} to fill in before sending.
            </p>
          )}

          <div className="grid gap-4 pt-1 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <SectionLabel icon={<Paperclip className="size-3" />}>
                Attach before sending
              </SectionLabel>
              <ul className="flex flex-col gap-1.5">
                {draft.suggestedAttachments.map((a, i) => (
                  <CheckItem key={i}>{a}</CheckItem>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <SectionLabel icon={<ClipboardList className="size-3" />}>
                Pre-send checklist
              </SectionLabel>
              <ul className="flex flex-col gap-1.5">
                {draft.preSendChecklist.map((c, i) => (
                  <CheckItem key={i}>{c}</CheckItem>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
            <Button size="sm" onClick={copyEmail}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy email"}
            </Button>
            <a
              href={mailto}
              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
            >
              <Mail />
              Open in mail client
            </a>
            <Button
              size="sm"
              variant="ghost"
              onClick={runItBack}
              disabled={check.status === "running"}
            >
              <Sparkles />
              {check.status === "running"
                ? "Reading..."
                : `Run it back past ${firstName}`}
            </Button>
          </div>

          {check.status !== "idle" && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <SectionLabel icon={<Sparkles className="size-3" />}>
                {firstName}&apos;s read on this email
              </SectionLabel>
              <div className="mt-2">
                {check.status === "running" && (
                  <p className="animate-pulse font-mono text-xs text-muted-foreground">
                    {firstName} is reading it back...
                  </p>
                )}
                {check.status === "error" && (
                  <p className="text-xs text-destructive">{check.message}</p>
                )}
                {check.status === "done" && (
                  <div className="flex flex-col gap-2">
                    <VerdictStamp action={check.action.name} />
                    <p className="text-xs leading-relaxed text-foreground/80">
                      {actionSummary(check.action)}
                    </p>
                    {check.score && (
                      <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                        <span className="tracking-widest text-muted-foreground uppercase">
                          Viability
                        </span>
                        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(100, check.score.score)
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="font-semibold text-foreground">
                          {check.score.score}/100
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="diff" className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <SectionLabel>Original pitch</SectionLabel>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {originalPitch}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <SectionLabel tone="primary">Send-ready email</SectionLabel>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
                {withMergeFields(body)}
              </div>
            </div>
          </div>

          {draft.keyProofPoints.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel>Proof points carried in</SectionLabel>
              <ul className="flex flex-col gap-1.5 font-mono text-[11px] leading-relaxed">
                {draft.keyProofPoints.map((point, i) => (
                  <li key={i} className="flex gap-1.5 text-muted-foreground">
                    <span className="text-primary">+</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
