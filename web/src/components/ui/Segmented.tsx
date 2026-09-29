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
    const key = event.key;
    if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "ArrowUp" && key !== "ArrowDown" && key !== "Home" && key !== "End") return;
    event.preventDefault();
    const index = Math.max(0, options.findIndex((option) => option.value === value));
    const nextIndex =
      key === "Home" ? 0 : key === "End" ? options.length - 1 : key === "ArrowRight" || key === "ArrowDown" ? (index + 1) % options.length : (index - 1 + options.length) % options.length;
    const next = options[nextIndex];
    if (!next) return;
    onChange(next.value);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
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
            tabIndex={selected ? 0 : -1}
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
