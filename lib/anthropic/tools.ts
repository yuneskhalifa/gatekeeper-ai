import type Anthropic from "@anthropic-ai/sdk";

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

export const requestDataTool: Anthropic.Tool = {
  name: "request_data",
  description:
    "Demand concrete evidence before considering the pitch further — real metrics, customer names, or data that's currently missing.",
  input_schema: {
    type: "object",
    properties: {
      request: {
        type: "string",
        description:
          "Exactly what data or evidence you're demanding, and why it's necessary to move forward.",
      },
    },
    required: ["request"],
  },
};

export const askQuestionTool: Anthropic.Tool = {
  name: "ask_question",
  description:
    "Ask one clarifying question that would change whether this pitch is worth covering (e.g. timing, exclusivity, competitive differentiation).",
  input_schema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The single clarifying question you're asking.",
      },
    },
    required: ["question"],
  },
};

export const bookMeetingTool: Anthropic.Tool = {
  name: "book_meeting",
  description:
    "Accept the pitch and propose meeting times. Only use this when the pitch has real substance and answers why it matters now.",
  input_schema: {
    type: "object",
    properties: {
      proposedTimes: {
        type: "array",
        items: { type: "string" },
        description: "1-3 proposed meeting time slots or windows.",
      },
      notes: {
        type: "string",
        description: "Any conditions or context for the meeting (optional).",
      },
    },
    required: ["proposedTimes"],
  },
};

// The four discrete actions the journalist can take on a given turn.
export const actionTools: Anthropic.Tool[] = [
  rejectPitchTool,
  requestDataTool,
  askQuestionTool,
  bookMeetingTool,
];

export const scorePitchTool: Anthropic.Tool = {
  name: "score_pitch",
  description:
    "Score the pitch's viability for coverage, independent of which action was just taken. Always called once per turn.",
  input_schema: {
    type: "object",
    properties: {
      score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Overall pitch viability score, 0-100.",
      },
      strengths: {
        type: "array",
        items: { type: "string" },
        description: "What's working in this pitch, if anything.",
      },
      weaknesses: {
        type: "array",
        items: { type: "string" },
        description: "What's missing or wrong in this pitch, if anything.",
      },
      verdict: {
        type: "string",
        description: "One-sentence summary of where this pitch stands.",
      },
    },
    required: ["score", "strengths", "weaknesses", "verdict"],
  },
};
