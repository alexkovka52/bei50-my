"use client";

import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./styles";

type ModeSwitchProps = {
  value: "2d" | "3d";
  onChange: (value: "2d" | "3d") => void;
};

const options = [
  { value: "2d", label: "2D" },
  { value: "3d", label: "3D" },
] as const;

export function ModeSwitch({ value, onChange }: ModeSwitchProps) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key;
    if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "ArrowUp" && key !== "ArrowDown" && key !== "Home" && key !== "End") return;
    event.preventDefault();
    const index = value === "3d" ? 1 : 0;
    const forward = key === "ArrowRight" || key === "ArrowDown";
    const nextIndex = key === "Home" ? 0 : key === "End" ? 1 : (index + (forward ? 1 : -1) + 2) % 2;
    const next = nextIndex === 0 ? "2d" : "3d";
    onChange(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="View"
      onKeyDown={onKeyDown}
      className="flex shrink-0 rounded-pill border border-[rgba(227,238,212,0.14)] bg-[rgba(15,42,29,0.76)] p-[3px] min-[1025px]:border-transparent min-[1025px]:bg-[rgba(227,238,212,0.08)]"
    >
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
              "inline-flex h-11 min-w-11 items-center justify-center rounded-pill px-3.5 text-sm min-[1025px]:px-4",
              focusRing,
              selected ? "bg-dew font-semibold text-forest" : "text-mist",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
