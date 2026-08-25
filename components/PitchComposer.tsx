"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col gap-2 border-t border-border pt-4">
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
        rows={5}
        disabled={disabled}
      />
      <Button onClick={handleSubmit} disabled={disabled || !value.trim()}>
        {disabled ? "Reading..." : "Send Pitch"}
      </Button>
    </div>
  );
}
