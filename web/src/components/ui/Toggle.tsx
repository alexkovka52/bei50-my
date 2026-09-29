"use client";

import { cn } from "@/lib/utils";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  surface?: "light" | "dark";
};

export function Toggle({ checked, onChange, label, surface = "light" }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex h-11 min-w-11 items-center justify-center"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-[34px] items-center rounded-pill p-0.5",
          checked ? "justify-end bg-budbreak" : "justify-start",
          !checked && surface === "dark" && "bg-[rgba(227,238,212,0.2)]",
          !checked && surface === "light" && "bg-[rgba(15,42,29,0.12)]",
        )}
      >
        <span className={cn("size-4 rounded-full", checked ? "bg-forest" : "bg-lichen")} />
      </span>
    </button>
  );
}
