import { Badge } from "@/components/ui/badge";

const ACTION_LABELS: Record<
  string,
  { label: string; variant: "default" | "destructive" | "secondary" | "outline" }
> = {
  reject_pitch: { label: "Rejected", variant: "destructive" },
  request_data: { label: "Data Requested", variant: "secondary" },
  ask_question: { label: "Question Asked", variant: "outline" },
  book_meeting: { label: "Meeting Booked", variant: "default" },
};

export function ToolActionBadge({ action }: { action: string }) {
  const meta = ACTION_LABELS[action] ?? { label: action, variant: "outline" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
