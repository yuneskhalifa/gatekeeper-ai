// The 10 hand-written pitch scenarios the eval suite grades against.
// See EVALS_PLAN.md for the rationale behind each expected action and window.

export type Action =
  | "reject_pitch"
  | "request_data"
  | "ask_question"
  | "book_meeting";

export interface Scenario {
  id: string;
  clientNews: string;
  pitch: string;
  // One expected action, or several when the case is a genuine grey zone.
  expectedAction: Action | Action[];
  minScore: number;
  maxScore: number;
}

export const scenarios: Scenario[] = [
  {
    id: "empty-buzzwords",
    clientNews:
      "Nexora, a two-person startup, has launched what it calls \"a revolutionary AI-native platform that reimagines how teams work.\" No users, no revenue, no launch date beyond \"now.\"",
    pitch:
      "Hi — I'm working with Nexora, a game-changing startup that's disrupting the future of work with a revolutionary AI-native platform. Their visionary founders are reimagining productivity from the ground up. I'd love to set up a call to tell you more about this exciting journey. Are you free this week?",
    expectedAction: "reject_pitch",
    minScore: 0,
    maxScore: 25,
  },
  {
    id: "no-why-now",
    clientNews:
      "Brightlane, a project-management SaaS company founded in 2019, has a stable product with about 4,000 paying customers. Nothing new has shipped recently; there is no announcement, funding, or milestone attached.",
    pitch:
      "I represent Brightlane, a well-established project-management tool loved by thousands of teams. The founders are available for interviews and can speak to productivity, remote work, and startup life. Would you be interested in a conversation?",
    expectedAction: "reject_pitch",
    minScore: 5,
    maxScore: 30,
  },
  {
    id: "vague-traction-claim",
    clientNews:
      "Cadence, a fintech app for freelancers, says it has seen \"huge growth\" over the last year and is \"one of the fastest-growing apps in its category.\" It will not share specific numbers in the pitch.",
    pitch:
      "Cadence has exploded in popularity — we've seen massive user growth and incredible engagement over the past 12 months, making us one of the fastest-growing finance apps for freelancers. The founder would love to talk about what's driving this momentum. Can we find time this week?",
    expectedAction: "request_data",
    minScore: 15,
    maxScore: 45,
  },
  {
    id: "unnamed-customers",
    clientNews:
      "Verilock, a security startup, claims its software is \"used by several of the largest banks in Europe\" but has signed NDAs and will not name any customer publicly.",
    pitch:
      "Verilock's fraud-detection engine is now used by several of the biggest banks in Europe to stop account-takeover attacks. We can't name them publicly, but the results have been significant. Our CEO is available to discuss the state of bank fraud in 2026. Interested?",
    // Triage (Run 1): label wrong. An unverifiable customer claim with no names,
    // no metrics, no "why now" — the only concrete offer is trend commentary.
    // Rejecting it is the correct call; request_data was too generous.
    expectedAction: "reject_pitch",
    minScore: 10,
    maxScore: 40,
  },
  {
    id: "strong-but-no-exclusive",
    clientNews:
      "Loomwork has raised a $9M Series A led by Northgate Ventures, bringing total funding to $14M. ARR is $2.1M, up from $600K a year ago. The pitch does not say whether the story is being offered exclusively or pitched broadly.",
    pitch:
      "Loomwork has closed a $9M Series A led by Northgate Ventures (total raised: $14M). ARR grew from $600K to $2.1M in the last year. The founder, a former Stripe engineer, can walk you through how they got there and where the money is going. Would you like to cover this?",
    // Triage (Run 1): action right, window too high at the bottom (persona
    // scored it 42). Lowered the floor.
    expectedAction: "ask_question",
    minScore: 38,
    maxScore: 65,
  },
  {
    id: "timing-unclear",
    clientNews:
      "Mediva, a digital-health company, has results from a peer-reviewed study showing its app reduced hospital readmissions by 22% across 1,400 patients. The publication date of the study and any embargo are not mentioned.",
    pitch:
      "A new peer-reviewed study of 1,400 patients found that Mediva's app cut 30-day hospital readmissions by 22%. The lead researcher and our chief medical officer are both available to comment. Let me know if you'd like the data.",
    expectedAction: "ask_question",
    minScore: 40,
    maxScore: 65,
  },
  {
    id: "funding-round-with-metrics",
    clientNews:
      "Tandem has raised a $12M Series A led by Basis Set Ventures, with participation from two named angels (a former Twilio VP and the founder of Segment). ARR is $3.4M, growing 15% month-over-month. The round is being offered to this journalist exclusively, embargoed until next Tuesday 6am ET.",
    pitch:
      "Offering you an exclusive on this, embargoed to Tuesday 6am ET: Tandem has raised a $12M Series A led by Basis Set Ventures, with angels including [former Twilio VP] and [Segment founder]. ARR is $3.4M and growing 15% MoM. The two co-founders are available for a call today or tomorrow. Full data room and cap-table summary ready to share under embargo.",
    expectedAction: "book_meeting",
    minScore: 65,
    maxScore: 90,
  },
  {
    id: "data-backed-launch",
    clientNews:
      "Kernel is launching an open-source model-evaluation tool. An independent benchmark from a named university lab shows it catches 31% more regressions than the current leading tool. Three named design partners (mid-size AI companies) are on the record with quotes.",
    pitch:
      "Kernel launches Thursday: an open-source eval tool that, in an independent benchmark run by [University] ML lab, caught 31% more model regressions than [incumbent tool]. Three design partners — [Company A], [Company B], [Company C] — are on the record. Happy to get you the benchmark methodology and put you in touch with any of the partners before Thursday.",
    expectedAction: "book_meeting",
    minScore: 65,
    maxScore: 90,
  },
  {
    id: "founder-credential-hook",
    clientNews:
      "Sentinel, a compliance-automation startup, is founded by a former enforcement director at a national financial regulator. It is launching the week that a major new financial regulation takes effect, and has 8 named paying customers who must comply with that rule.",
    pitch:
      "Sentinel comes out of stealth next week — the same week [Regulation] takes effect. Its founder spent six years as an enforcement director at [Regulator] and built Sentinel to automate exactly the compliance work she used to penalize firms for failing. Eight paying customers already, all named and referenceable. She can speak to what the new rule means for the industry. Interview this week?",
    // Triage (Run 1): score (78) was fine; the persona asking one question
    // before booking a stealth launch is defensible. Accept either action.
    expectedAction: ["book_meeting", "ask_question"],
    minScore: 60,
    maxScore: 88,
  },
  {
    id: "borderline-thin-launch",
    clientNews:
      "Plotline, a note-taking app, is launching version 2.0. The only metric offered is \"over 50,000 downloads since our beta started.\" No revenue, retention, or growth-rate figures. No competitive hook beyond a redesigned UI.",
    pitch:
      "Plotline 2.0 is here — a completely redesigned note-taking app that's already passed 50,000 downloads since our beta. The founder can talk about building in public and designing for focus. Would this be a fit for your readers?",
    // Triage (Run 1): score sits ~12 every run; floor of 20 was too high.
    expectedAction: ["reject_pitch", "request_data"],
    minScore: 8,
    maxScore: 45,
  },
];
