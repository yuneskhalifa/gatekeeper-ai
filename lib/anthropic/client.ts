import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Main journalist persona model — critique/persona quality is the product.
export const MODEL = "claude-sonnet-4-5";

// Cheaper/faster model for simpler tasks (Milestone 4 routing classifier,
// Milestone 5 eval grader) — not used yet.
export const FAST_MODEL = "claude-haiku-4-5";
