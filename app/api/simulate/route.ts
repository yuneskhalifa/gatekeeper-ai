import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic/client";
import { buildSystemPrompt, marcusChen } from "@/lib/anthropic/personas";
import { actionTools, scorePitchTool } from "@/lib/anthropic/tools";

// TODO(Phase 1.6): convert to streaming.

interface SimulateRequest {
  // Full prior conversation, ending with the latest user turn (the pitch,
  // or a refinement reply). Empty on the first call of a session.
  messages: Anthropic.MessageParam[];
}

function toolResultFor(
  toolUseId: string,
  content: string
): Anthropic.MessageParam {
  return {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: toolUseId, content }],
  };
}

function firstToolUse(
  message: Anthropic.Message
): Anthropic.ToolUseBlock | undefined {
  return message.content.find((b) => b.type === "tool_use");
}

export async function POST(req: Request) {
  const { messages }: SimulateRequest = await req.json();
  const system = [
    {
      type: "text" as const,
      text: buildSystemPrompt(marcusChen),
      cache_control: { type: "ephemeral" as const },
    },
  ];

  // Call 1: force exactly one of the four discrete actions.
  const actionMessage = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    tools: actionTools,
    tool_choice: { type: "any" },
    messages,
  });

  const actionUse = firstToolUse(actionMessage);
  if (!actionUse) {
    return Response.json(
      { error: "Journalist did not take an action.", raw: actionMessage },
      { status: 502 }
    );
  }

  const afterAction: Anthropic.MessageParam[] = [
    ...messages,
    { role: "assistant", content: actionMessage.content },
    toolResultFor(actionUse.id, "Action recorded."),
  ];

  // Call 2: always force a viability score, independent of the action.
  const scoreMessage = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system,
    tools: [scorePitchTool],
    tool_choice: { type: "tool", name: "score_pitch" },
    messages: afterAction,
  });

  const scoreUse = firstToolUse(scoreMessage);
  if (!scoreUse) {
    return Response.json(
      { error: "Journalist did not return a score.", raw: scoreMessage },
      { status: 502 }
    );
  }

  const updatedMessages: Anthropic.MessageParam[] = [
    ...afterAction,
    { role: "assistant", content: scoreMessage.content },
    toolResultFor(scoreUse.id, "Score recorded."),
  ];

  return Response.json({
    action: { name: actionUse.name, input: actionUse.input },
    score: scoreUse.input,
    messages: updatedMessages,
  });
}
