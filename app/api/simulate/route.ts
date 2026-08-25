import { anthropic, MODEL } from "@/lib/anthropic/client";
import { buildSystemPrompt, marcusChen } from "@/lib/anthropic/personas";
import { rejectPitchTool } from "@/lib/anthropic/tools";

// TODO(Phase 1.5): remaining action tools + score_pitch + multi-turn history.
// TODO(Phase 1.6): convert to streaming.
const HARDCODED_PITCH = `Subject: Revolutionary AI Startup Disrupts Everything

Hi, our AI platform is a game-changer for businesses everywhere. We use
cutting-edge machine learning to transform how companies operate. Let
me know if you'd like to chat!`;

export async function POST() {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: buildSystemPrompt(marcusChen),
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [rejectPitchTool],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: HARDCODED_PITCH }],
  });

  return Response.json(message);
}
