function Label({ children }: { children: string }) {
  return (
    <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
      {children}
    </p>
  );
}

const STEPS = [
  {
    title: "Paste the pitch",
    body: "Drop in the client's news and your drafted pitch, exactly as you'd send it.",
  },
  {
    title: "He reacts, in character",
    body: "The journalist reads it and takes one action: rejects it, demands real data, asks a question, or books the meeting.",
  },
  {
    title: "Refine and resend",
    body: "Rewrite in the same thread until it actually lands — not until you assume it would.",
  },
];

export function AboutPanel() {
  return (
    <aside className="hidden w-80 shrink-0 overflow-y-auto border-r border-border/60 bg-card/30 lg:block">
      <div className="flex flex-col gap-8 p-6">
        <div>
          <Label>Gatekeeper AI</Label>
          <p className="mt-3 font-heading text-xl leading-snug font-medium text-foreground italic">
            Stress-test a pitch before a real journalist does.
          </p>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Most pitch tools help you write. This one tells you whether it was
          worth sending — by roleplaying a specific, skeptical journalist
          who reacts to your pitch the way a real inbox would.
        </p>

        <div>
          <Label>How it works</Label>
          <ol className="mt-3 flex flex-col gap-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="font-mono text-xs text-primary/80 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
          Nothing is saved — refreshing starts a new thread with a clean
          journalist.
        </p>
      </div>
    </aside>
  );
}
