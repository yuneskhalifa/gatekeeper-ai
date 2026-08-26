import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic/client";
import { yunesKhalifa } from "@/lib/anthropic/personas";
import {
  buildComposerSystemPrompt,
  composePitchEmailTool,
  type PitchEmailDraft,
} from "@/lib/anthropic/compose";

export const runtime = "nodejs";

interface CompileEmailRequest {
  // The full simulator conversation, exactly as returned by /api/simulate's
  // `done` event — must end on a turn where the journalist ran book_meeting.
  messages: Anthropic.MessageParam[];
}

const COMPILE_INSTRUCTION = `The simulation is over — ${yunesKhalifa.name} just agreed to a meeting on the latest version of this pitch. Compile that pitch into the real outreach email I should send. Call compose_pitch_email once.`;

export async function POST(req: Request) {
  let body: CompileEmailRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "No simulation transcript to compile." },
      { status: 400 }
    );
  }

  const system = [
    {
      type: "text" as const,
      text: buildComposerSystemPrompt(yunesKhalifa),
      cache_control: { type: "ephemeral" as const },
    },
  ];

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      tools: [composePitchEmailTool],
      tool_choice: { type: "tool", name: "compose_pitch_email" },
      messages: [...messages, { role: "user", content: COMPILE_INSTRUCTION }],
    });

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse) {
      return Response.json(
        { error: "The model did not return an email draft." },
        { status: 502 }
      );
    }

    return Response.json({ draft: toolUse.input as PitchEmailDraft });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
