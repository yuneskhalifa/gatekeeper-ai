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
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
          />
        </div>
        <span className="text-sm font-medium tabular-nums">{score}/100</span>
      </div>
      <p className="text-xs text-muted-foreground">{verdict}</p>
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {strengths.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          {weaknesses.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {weaknesses.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
