import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-pill border border-lichen bg-paper px-4 text-[15px] text-forest",
        className,
      )}
    >
      {children}
    </span>
  );
}
