import type { TaskKind } from "@/lib/walks/tasks";
import { cn } from "@/lib/utils";

export function KindMark({ kind, size = "sm" }: { kind: TaskKind; size?: "sm" | "lg" }) {
  const waste = kind === "waste";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "lg" ? "size-11 rounded-[14px]" : "size-8 rounded-[10px]",
        waste ? "bg-[rgba(201,67,47,0.14)]" : "bg-[rgba(224,154,45,0.18)]",
      )}
    >
      <span className={cn(size === "lg" ? "size-3.5" : "size-2.5", waste ? "rounded-[2px] bg-waste" : "rounded-full bg-gap")} />
    </span>
  );
}
