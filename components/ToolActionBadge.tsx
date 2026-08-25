const STAMP_STYLES: Record<string, { label: string; classes: string }> = {
  reject_pitch: {
    label: "Rejected",
    classes: "border-destructive text-destructive",
  },
  request_data: {
    label: "Data Requested",
    classes: "border-muted-foreground text-muted-foreground",
  },
  ask_question: {
    label: "Question Asked",
    classes: "border-muted-foreground text-muted-foreground",
  },
  book_meeting: {
    label: "Meeting Booked",
    classes: "border-primary text-primary",
  },
};

// The signature element: a rotated, ink-stamped verdict — evokes a
// journalist stamping a pitch REJECTED/BOOKED rather than a generic chip.
export function VerdictStamp({ action }: { action: string }) {
  const meta = STAMP_STYLES[action] ?? {
    label: action,
    classes: "border-muted-foreground text-muted-foreground",
  };

  return (
    <span
      className={`animate-in zoom-in-90 fade-in inline-block w-fit -rotate-3 rounded-sm border-2 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-widest uppercase duration-300 ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}
