"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Copy,
  Send,
  Paperclip,
  Sparkles,
} from "lucide-react";
import type { PitchEmailDraft } from "@/lib/anthropic/compose";
import { yunesKhalifa } from "@/lib/anthropic/personas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const MERGE_FIELD = /\[\[.+?\]\]/g;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// --- SMTP send -----------------------------------------------------------
// The compiled (and possibly edited) email goes out over the SMTP transport
// configured in .env.local. Nothing is sent until the consultant clicks send.

type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { status: "error"; message: string };

export function PitchEmail({
  draft,
  originalPitch,
}: {
  draft: PitchEmailDraft;
  originalPitch: string;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);
  const [send, setSend] = useState<SendState>({ status: "idle" });

  const mergeFieldCount = useMemo(
    () => (`${subject}\n${body}`.match(MERGE_FIELD) ?? []).length,
    [subject, body]
  );

  const toValid = EMAIL_RE.test(to.trim());
  const canSend =
    toValid && subject.trim().length > 0 && body.trim().length > 0 && mergeFieldCount === 0;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — no-op
    }
  }

  async function sendEmail() {
    setSend({ status: "sending" });
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject, body }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSend({
          status: "error",
          message: data.error ?? "Couldn't send the email.",
        });
        return;
      }
      setSend({ status: "sent" });
    } catch {
      setSend({ status: "error", message: "Something went wrong sending the email." });
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
            <div className="flex items-center gap-2 border-b border-border/40">
              <span className="w-16 shrink-0 text-muted-foreground">To</span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={`${yunesKhalifa.name.toLowerCase().replace(" ", ".")}@${yunesKhalifa.outlet
                  .toLowerCase()
                  .replace(/[^a-z]/g, "")}.com`}
                className="w-full bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                aria-label="Recipient email address"
                type="email"
              />
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

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <Button
              size="sm"
              onClick={sendEmail}
              disabled={!canSend || send.status === "sending" || send.status === "sent"}
            >
              {send.status === "sent" ? <Check /> : <Send />}
              {send.status === "sending"
                ? "Sending..."
                : send.status === "sent"
                  ? "Sent"
                  : "Send email"}
            </Button>
            <Button size="sm" variant="outline" onClick={copyEmail}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy email"}
            </Button>
            {to.length > 0 && !toValid && (
              <span className="text-[11px] text-destructive">
                Enter a valid email address.
              </span>
            )}
            {toValid && mergeFieldCount > 0 && send.status === "idle" && (
              <span className="text-[11px] text-muted-foreground">
                Fill in the merge fields to enable send.
              </span>
            )}
          </div>

          {send.status === "error" && (
            <p className="text-xs text-destructive">{send.message}</p>
          )}
          {send.status === "sent" && (
            <p className="text-xs text-primary">
              Email sent to {to.trim()}.
            </p>
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
