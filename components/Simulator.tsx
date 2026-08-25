"use client";

import { useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import { yunesKhalifa } from "@/lib/anthropic/personas";
import { PitchComposer } from "@/components/PitchComposer";
import { Transcript, type Turn } from "@/components/Transcript";
import { AboutPanel } from "@/components/AboutPanel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type SimulateEvent =
  | { type: "action_start" }
  | { type: "action_delta"; text: string }
  | { type: "action"; action: { name: string; input: Record<string, unknown> } }
  | { type: "score_start" }
  | { type: "score_delta"; text: string }
  | {
      type: "score";
      score: {
        score: number;
        strengths: string[];
        weaknesses: string[];
        verdict: string;
      };
    }
  | { type: "done"; messages: Anthropic.MessageParam[] }
  | { type: "error"; message: string };

function emptyTurn(pitch: string): Turn {
  return { pitch, actionRaw: "", scoreRaw: "", status: "action" };
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function Simulator() {
  const [history, setHistory] = useState<Anthropic.MessageParam[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);

  function patchTurn(index: number, patch: Partial<Turn>) {
    setTurns((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  async function sendPitch(text: string) {
    const requestMessages: Anthropic.MessageParam[] = [
      ...history,
      { role: "user", content: text },
    ];
    const turnIndex = turns.length;
    setTurns((prev) => [...prev, emptyTurn(text)]);
    setPending(true);

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages }),
      });

      if (!res.body) {
        patchTurn(turnIndex, { error: "No response body.", status: "done" });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data: ")) continue;
          const event: SimulateEvent = JSON.parse(line.slice("data: ".length));

          switch (event.type) {
            case "action_delta":
              setTurns((prev) => {
                const next = [...prev];
                next[turnIndex] = {
                  ...next[turnIndex],
                  actionRaw: next[turnIndex].actionRaw + event.text,
                };
                return next;
              });
              break;
            case "action":
              patchTurn(turnIndex, { action: event.action, status: "score" });
              break;
            case "score_delta":
              setTurns((prev) => {
                const next = [...prev];
                next[turnIndex] = {
                  ...next[turnIndex],
                  scoreRaw: next[turnIndex].scoreRaw + event.text,
                };
                return next;
              });
              break;
            case "score":
              patchTurn(turnIndex, { score: event.score, status: "done" });
              break;
            case "error":
              patchTurn(turnIndex, { error: event.message, status: "done" });
              break;
            case "done":
              setHistory(event.messages);
              break;
          }
        }
      }
    } catch {
      patchTurn(turnIndex, {
        error: "Something went wrong talking to the journalist.",
        status: "done",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-dvh bg-background">
      <AboutPanel />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-6 py-4">
            <Avatar size="lg" className="border border-primary/40">
              <AvatarFallback className="bg-primary/15 font-mono text-xs font-semibold text-primary">
                {initials(yunesKhalifa.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-heading text-lg font-semibold leading-tight text-foreground">
                {yunesKhalifa.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Journalist · {yunesKhalifa.outlet} · {yunesKhalifa.beat}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-6 py-8">
            <Transcript turns={turns} />
          </div>
        </div>

        <footer className="sticky bottom-0">
          <div
            aria-hidden
            className="h-8 bg-gradient-to-t from-background to-transparent"
          />
          <div className="bg-background pb-6">
            <div className="mx-auto w-full max-w-4xl px-6">
              <PitchComposer disabled={pending} onSubmit={sendPitch} />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
