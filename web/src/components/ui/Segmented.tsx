"use client";

import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

type SegmentedProps = {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
};

export function Segmented({ label, value, options, onChange }: SegmentedProps) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const start = index < 0 ? 0 : index;
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = options[(start + delta + options.length) % options.length];
    if (next) onChange(next.value);
  }

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="inline-flex gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-pill border px-4 text-[15px] font-semibold",
              selected ? "border-budbreak bg-paper text-forest" : "border-transparent text-ink-muted hover:bg-paper",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
