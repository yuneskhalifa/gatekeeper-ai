import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic/client";
import { buildSystemPrompt, yunesKhalifa } from "@/lib/anthropic/personas";
import { actionTools, scorePitchTool } from "@/lib/anthropic/tools";

export const runtime = "nodejs";

interface SimulateRequest {
  // Full prior conversation, ending with the latest user turn (the pitch,
  // or a refinement reply). Empty on the first call of a session.
  messages: Anthropic.MessageParam[];
}

// Server-Sent Events emitted, in order, over the life of one POST:
//   action_start -> action_delta* -> action -> score_start -> score_delta* -> score -> done
// or an `error` event at any point, always followed by the stream closing.
type SimulateEvent =
  | { type: "action_start" }
  | { type: "action_delta"; text: string }
  | { type: "action"; action: { name: string; input: unknown } }
  | { type: "score_start" }
  | { type: "score_delta"; text: string }
  | { type: "score"; score: unknown }
  | { type: "done"; messages: Anthropic.MessageParam[] }
  | { type: "error"; message: string };

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
      text: buildSystemPrompt(yunesKhalifa),
      cache_control: { type: "ephemeral" as const },
    },
  ];

  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (event: SimulateEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // Call 1: force exactly one of the four discrete actions, streamed.
        send({ type: "action_start" });
        const actionStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system,
          tools: actionTools,
          tool_choice: { type: "any" },
          messages,
        });
        actionStream.on("inputJson", (partialJson) => {
          send({ type: "action_delta", text: partialJson });
        });
        const actionMessage = await actionStream.finalMessage();

        const actionUse = firstToolUse(actionMessage);
        if (!actionUse) {
          send({ type: "error", message: "Journalist did not take an action." });
          return;
        }
        send({
          type: "action",
          action: { name: actionUse.name, input: actionUse.input },
        });

        const afterAction: Anthropic.MessageParam[] = [
          ...messages,
          { role: "assistant", content: actionMessage.content },
          toolResultFor(actionUse.id, "Action recorded."),
        ];

        // Call 2: always force a viability score, independent of the action.
        send({ type: "score_start" });
        const scoreStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 512,
          system,
          tools: [scorePitchTool],
          tool_choice: { type: "tool", name: "score_pitch" },
          messages: afterAction,
        });
        scoreStream.on("inputJson", (partialJson) => {
          send({ type: "score_delta", text: partialJson });
        });
        const scoreMessage = await scoreStream.finalMessage();

        const scoreUse = firstToolUse(scoreMessage);
        if (!scoreUse) {
          send({ type: "error", message: "Journalist did not return a score." });
          return;
        }
        send({ type: "score", score: scoreUse.input });

        const updatedMessages: Anthropic.MessageParam[] = [
          ...afterAction,
          { role: "assistant", content: scoreMessage.content },
          toolResultFor(scoreUse.id, "Score recorded."),
        ];

        send({ type: "done", messages: updatedMessages });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
