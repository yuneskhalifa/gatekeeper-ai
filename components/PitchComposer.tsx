"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export function PitchComposer({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setValue("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative flex items-end rounded-[1.75rem] border border-border bg-card shadow-lg shadow-black/20 transition-all focus-within:border-primary/50 focus-within:shadow-primary/10">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Paste the client's news + your drafted pitch..."
          rows={1}
          disabled={disabled}
          className="min-h-[3.25rem] resize-none border-0 bg-transparent py-3.5 pr-14 pl-5 text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          aria-label={disabled ? "Waiting for reply" : "Send pitch"}
          className="absolute right-2.5 bottom-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/30 transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:shadow-none"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
      <p className="px-2 text-[11px] text-muted-foreground/70">
        {disabled ? "Yunes is reading..." : "⌘/Ctrl + Enter to send"}
      </p>
    </div>
  );
}
