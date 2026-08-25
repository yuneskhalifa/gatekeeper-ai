import type Anthropic from "@anthropic-ai/sdk";

// TODO(Phase 1.5): request_data, ask_question, book_meeting, score_pitch.
export const rejectPitchTool: Anthropic.Tool = {
  name: "reject_pitch",
  description:
    "Reject the pitch as not worth covering. Use this when the pitch lacks substance, metrics, or a real reason to care right now.",
  input_schema: {
    type: "object",
    properties: {
      critique: {
        type: "string",
        description:
          "A specific, harsh-but-fair explanation of exactly what is wrong with this pitch — not generic feedback.",
      },
    },
    required: ["critique"],
  },
};
