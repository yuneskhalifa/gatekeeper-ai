import type Anthropic from "@anthropic-ai/sdk";
import type { Persona } from "@/lib/anthropic/personas";

// The single structured artifact produced once the journalist would book the
// meeting: the pitch, rewritten as the real outreach email plus the human
// review gate that runs before anyone hits send.
export interface PitchEmailDraft {
  subject: string;
  body: string;
  keyProofPoints: string[];
  simulationEdits: string[];
  suggestedAttachments: string[];
  preSendChecklist: string[];
}

export const composePitchEmailTool: Anthropic.Tool = {
  name: "compose_pitch_email",
  description:
    "Compile the pitch that just cleared the simulation into the real cold-outreach email the PR consultant will send to this journalist. Called exactly once.",
  input_schema: {
    type: "object",
    properties: {
      subject: {
        type: "string",
        description:
          "The email subject line — specific and newsworthy, built from the actual story. Never a generic filler like \"Story idea\" or \"Quick question\".",
      },
      body: {
        type: "string",
        description:
          "The full email body, ready to send. Plain text, short paragraphs. Use [[double-bracket merge fields]] for anything not established in the transcript (the consultant's name, contact details, exact availability, embargo dates). End with one specific, low-friction call to action.",
      },
      keyProofPoints: {
        type: "array",
        items: { type: "string" },
        description:
          "The concrete facts carried into the email that earned the meeting — metrics, named customers, the founder's credential, the 'why now'. Each must appear in the transcript.",
      },
      simulationEdits: {
        type: "array",
        items: { type: "string" },
        description:
          "What changed versus the consultant's original pitch and which journalist turn forced it, one per change (e.g. \"Added the 40% error-reduction figure — journalist ran request_data on turn 2\").",
      },
      suggestedAttachments: {
        type: "array",
        items: { type: "string" },
        description:
          "Files the consultant should gather before sending (case study, founder bio, embargoed data sheet), derived from what the journalist asked for across the thread.",
      },
      preSendChecklist: {
        type: "array",
        items: { type: "string" },
        description:
          "The human-review gate: everything the consultant must verify or fill in before this email is safe to send (fill in merge fields, confirm figures with the client, confirm embargo date).",
      },
    },
    required: [
      "subject",
      "body",
      "keyProofPoints",
      "simulationEdits",
      "suggestedAttachments",
      "preSendChecklist",
    ],
  },
};

// System prompt for the compile step. The perspective flips: the simulator
// speaks AS the journalist; here Claude is the PR consultant's drafting hand,
// and the journalist's pet peeves become hard constraints on the draft.
export function buildComposerSystemPrompt(persona: Persona): string {
  return `<role>
  You are an expert PR consultant. A drafted pitch has just been stress-tested, turn by turn, against a simulation of the journalist below, and it finally earned a meeting. Nothing has been sent yet — that was a rehearsal. Your job now is to compile the pitch, in the state that earned the meeting, into the real cold-outreach email the consultant will actually send.
</role>

<recipient>
  <name>${persona.name}</name>
  <outlet>${persona.outlet}</outlet>
  <beat>${persona.beat}</beat>
  <instant_delete_triggers>
${persona.petPeeves.map((p) => `    - ${p}`).join("\n")}
  </instant_delete_triggers>
</recipient>

<rules>
  - Write only from facts established in the transcript. Do not invent metrics, customer names, dates, credentials, or contact details.
  - For anything you need but the transcript does not give you — the consultant's name and contact info, exact availability, embargo dates — leave a [[double-bracket merge field]] the consultant fills in. Never guess.
  - Every proof point the journalist demanded across the thread must appear in the body. If a turn used request_data or ask_question, the answer given in a later turn belongs in the email.
  - Match the recipient's standards: no buzzwords, no vague claims, every sentence concrete. Mirror their brevity — this is a busy editor, keep it tight.
  - The call to action is one short, specific ask (a brief call), and it proposes the consultant's availability as a [[merge field]] — it does NOT reference times the simulated journalist "offered", which are fictional.
  - Call compose_pitch_email exactly once. Do not reply with plain text.
</rules>`;
}
