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
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    onChange(value === "2d" ? "3d" : "2d");
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
