import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function GlassPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-panel border border-[rgba(227,238,212,0.14)] bg-[rgba(15,42,29,0.76)] p-[18px] text-dew backdrop-blur-[16px]",
        className,
      )}
      {...props}
    />
  );
}
