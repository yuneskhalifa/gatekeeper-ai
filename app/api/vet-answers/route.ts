import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, FAST_MODEL } from "@/lib/anthropic/client";
import { yunesKhalifa } from "@/lib/anthropic/personas";
import {
  buildVetSystemPrompt,
  vetAnswersTool,
  type AnswerVerdict,
} from "@/lib/anthropic/vet";

export const runtime = "nodejs";

interface VetAnswersRequest {
  // Only the weaknesses the consultant actually answered, each carrying its
  // original row index so the client can map verdicts back to the form.
  answers?: { index: number; weakness: string; answer: string }[];
}

export async function POST(req: Request) {
  let body: VetAnswersRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const answers = Array.isArray(body.answers)
    ? body.answers.filter(
        (a) =>
          a &&
          typeof a.index === "number" &&
          typeof a.weakness === "string" &&
          typeof a.answer === "string" &&
          a.answer.trim().length > 0
      )
    : [];

  if (answers.length === 0) {
    return Response.json({ verdicts: [] as AnswerVerdict[] });
  }

  const list = answers
    .map(
      (a, i) =>
        `Answer ${i} (index ${a.index}):\n  Weakness: ${a.weakness}\n  Consultant's answer: ${a.answer.trim()}`
    )
    .join("\n\n");

  const system = [
    {
      type: "text" as const,
      text: buildVetSystemPrompt(yunesKhalifa),
      cache_control: { type: "ephemeral" as const },
    },
  ];

  try {
    const message = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 1024,
      system,
      tools: [vetAnswersTool],
      tool_choice: { type: "tool", name: "vet_answers" },
      messages: [
        {
          role: "user",
          content: `Judge these ${answers.length} answer(s). Use the "index" value shown for each in your verdicts.\n\n${list}`,
        },
      ],
    });

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse) {
      return Response.json(
        { error: "The model did not return verdicts." },
        { status: 502 }
      );
    }

    const { verdicts } = toolUse.input as { verdicts: AnswerVerdict[] };
    return Response.json({ verdicts: Array.isArray(verdicts) ? verdicts : [] });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
