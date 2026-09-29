import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = {
  children: ReactNode;
  tone?: "lime" | "moss" | "paper";
  className?: string;
};

const toneClass = {
  lime: "bg-budbreak text-forest",
  moss: "bg-moss text-paper",
  paper: "border border-lichen bg-paper text-forest",
} as const;

export function Badge({ children, tone = "lime", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-pill px-2.5 py-1 text-[13px] font-semibold", toneClass[tone], className)}>
      {children}
    </span>
  );
}
