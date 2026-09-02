import type Anthropic from "@anthropic-ai/sdk";
import type { Persona } from "@/lib/anthropic/personas";

// A quick sanity check on the consultant's answers to the weaknesses the final
// score still flagged, before those answers get folded into the outreach email.
// Catches gibberish, off-topic replies, and non-answers so the form can send
// them back to the consultant instead of compiling them in.

export interface AnswerVerdict {
  index: number;
  usable: boolean;
  // One short sentence for the consultant when usable is false; "" otherwise.
  issue: string;
}

export const vetAnswersTool: Anthropic.Tool = {
  name: "vet_answers",
  description:
    "Judge whether each consultant answer actually addresses the weakness it is paired with and is solid enough to put in a real journalist outreach email.",
  input_schema: {
    type: "object",
    properties: {
      verdicts: {
        type: "array",
        description: "One verdict per answer, in the same order as given.",
        items: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "The 0-based index of the answer being judged.",
            },
            usable: {
              type: "boolean",
              description:
                "true only if the answer is on-topic for that specific weakness, coherent, concrete enough to state in an email, and doesn't contradict the pitch.",
            },
            issue: {
              type: "string",
              description:
                "If usable is false, one short, plain sentence telling the consultant what's wrong (e.g. \"This doesn't address the revenue question\", \"This isn't a coherent answer\", \"Too vague to put in the email\"). Empty string if usable is true.",
            },
          },
          required: ["index", "usable", "issue"],
        },
      },
    },
    required: ["verdicts"],
  },
};

export function buildVetSystemPrompt(persona: Persona): string {
  return `<role>
  You are a meticulous PR editor. A colleague has answered a list of weaknesses that ${persona.name} (${persona.outlet}, ${persona.beat}) flagged about a pitch. Each answer is meant to be folded into the real outreach email.
</role>

<task>
  For each answer, decide whether it is usable:
  - It must directly address that specific weakness, not a different one.
  - It must be coherent and make sense.
  - It must be concrete enough to state in an email to a journalist.
  - It must not contradict the pitch.

  Reject gibberish, empty filler, one-word non-answers, off-topic replies, and claims that plainly make no sense. Do NOT reject an answer just for being short if it genuinely responds to the weakness.

  Call vet_answers exactly once with one verdict per answer.
</task>`;
}
