import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic/client";
import { buildSystemPrompt, yunesKhalifa } from "@/lib/anthropic/personas";
import { actionTools, scorePitchTool } from "@/lib/anthropic/tools";

// The persona system prompt, cached — shared by the streaming route and the
// non-streaming turn runner below.
export function buildSystem(): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text",
      text: buildSystemPrompt(yunesKhalifa),
      cache_control: { type: "ephemeral" },
    },
  ];
}

export function toolResultFor(
  toolUseId: string,
  content: string
): Anthropic.MessageParam {
  return {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: toolUseId, content }],
  };
}

export function firstToolUse(
  message: Anthropic.Message
): Anthropic.ToolUseBlock | undefined {
  return message.content.find((b) => b.type === "tool_use");
}

export interface JournalistScore {
  score: number;
  strengths: string[];
  weaknesses: string[];
  verdict: string;
}

export interface JournalistTurn {
  action: { name: string; input: Record<string, unknown> };
  score: JournalistScore;
}

// One full journalist turn, non-streaming: force one of the four discrete
// actions, then force a viability score. Same two-call sequence the /api/simulate
// route streams — this is the shape the eval runner grades against.
export async function runJournalistTurn(
  messages: Anthropic.MessageParam[]
): Promise<JournalistTurn> {
  const system = buildSystem();

  const actionMessage = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    tools: actionTools,
    tool_choice: { type: "any" },
    messages,
  });
  const actionUse = firstToolUse(actionMessage);
  if (!actionUse) throw new Error("Journalist did not take an action.");

  const afterAction: Anthropic.MessageParam[] = [
    ...messages,
    { role: "assistant", content: actionMessage.content },
    toolResultFor(actionUse.id, "Action recorded."),
  ];

  const scoreMessage = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system,
    tools: [scorePitchTool],
    tool_choice: { type: "tool", name: "score_pitch" },
    messages: afterAction,
  });
  const scoreUse = firstToolUse(scoreMessage);
  if (!scoreUse) throw new Error("Journalist did not return a score.");

  return {
    action: {
      name: actionUse.name,
      input: actionUse.input as Record<string, unknown>,
    },
    score: scoreUse.input as unknown as JournalistScore,
  };
}
