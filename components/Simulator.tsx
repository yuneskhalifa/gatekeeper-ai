"use client";

import { useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import { marcusChen } from "@/lib/anthropic/personas";
import { PitchComposer } from "@/components/PitchComposer";
import { Transcript, type Turn } from "@/components/Transcript";

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
    <div className="mx-auto flex h-screen w-full max-w-2xl flex-col gap-4 p-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-lg font-semibold">Gatekeeper AI</h1>
        <p className="text-sm text-muted-foreground">
          Pitching {marcusChen.name} · {marcusChen.outlet} · {marcusChen.beat}
        </p>
      </header>
      <Transcript turns={turns} />
      <PitchComposer disabled={pending} onSubmit={sendPitch} />
    </div>
  );
}
