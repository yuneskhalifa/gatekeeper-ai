import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic/client";
import { yunesKhalifa } from "@/lib/anthropic/personas";
import {
  buildComposerSystemPrompt,
  composePitchEmailTool,
  type PitchEmailDraft,
} from "@/lib/anthropic/compose";

export const runtime = "nodejs";

interface WeaknessResponse {
  weakness: string;
  answer: string;
}

interface CompileEmailRequest {
  // The full simulator conversation, exactly as returned by /api/simulate's
  // `done` event — must end on a turn where the journalist ran book_meeting.
  messages: Anthropic.MessageParam[];
  // Optional: the consultant's answers to weaknesses the final score still
  // flagged. Only answered ones are sent; skipped points are omitted.
  weaknessResponses?: WeaknessResponse[];
}

const COMPILE_INSTRUCTION = `The simulation is over — ${yunesKhalifa.name} just agreed to a meeting on the latest version of this pitch. Compile that pitch into the real outreach email I should send. Call compose_pitch_email once.`;

function buildInstruction(responses: WeaknessResponse[]): string {
  if (responses.length === 0) return COMPILE_INSTRUCTION;

  const answered = responses
    .map((r) => `- Concern: ${r.weakness}\n  My answer: ${r.answer}`)
    .join("\n");

  return `${COMPILE_INSTRUCTION}

The final viability score still flagged some gaps. Here are my answers to the ones I could address — treat them as established facts from me, the consultant, and work each one into the email where it makes the pitch more concrete and credible:

${answered}

Any gap I did not answer stays out of the email — do not paper over it, guess at it, or invent a response. Still use [[merge fields]] for anything neither the transcript nor my answers establish.`;
}

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

  const weaknessResponses: WeaknessResponse[] = Array.isArray(
    body.weaknessResponses
  )
    ? body.weaknessResponses
        .filter(
          (r): r is WeaknessResponse =>
            !!r &&
            typeof r.weakness === "string" &&
            typeof r.answer === "string" &&
            r.answer.trim().length > 0
        )
        .map((r) => ({ weakness: r.weakness, answer: r.answer.trim() }))
    : [];

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
      messages: [
        ...messages,
        { role: "user", content: buildInstruction(weaknessResponses) },
      ],
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
