export function ScoreGauge({
  score,
  verdict,
  strengths,
  weaknesses,
}: {
  score: number;
  verdict: string;
  strengths: string[];
  weaknesses: string[];
}) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <div className="flex items-baseline justify-between font-mono">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          Viability
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {clamped}
          <span className="text-muted-foreground">/100</span>
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground italic">{verdict}</p>

      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="grid grid-cols-2 gap-3 pt-1 font-mono text-[11px] leading-relaxed">
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest text-primary uppercase">
              Strengths
            </p>
            {strengths.length > 0 ? (
              <ul className="space-y-1">
                {strengths.map((s, i) => (
                  <li key={i} className="flex gap-1.5 text-muted-foreground">
                    <span className="text-primary">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground/60">None noted.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-widest text-destructive uppercase">
              Weaknesses
            </p>
            {weaknesses.length > 0 ? (
              <ul className="space-y-1">
                {weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-1.5 text-muted-foreground">
                    <span className="text-destructive">−</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground/60">None noted.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
