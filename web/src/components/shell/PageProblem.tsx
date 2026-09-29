"use client";

import { Button } from "@/components/ui/Button";

export function PageProblem({
  title,
  message,
  onRetry,
  tone = "light",
}: {
  title: string;
  message: string;
  onRetry: () => void;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div className="flex max-w-xl flex-col items-start gap-4">
      <h1
        className={
          dark
            ? "m-0 font-display text-[40px] font-bold leading-none tracking-[-1px] text-dew"
            : "m-0 font-display text-[40px] font-bold leading-none tracking-[-1px] text-forest"
        }
      >
        {title}
      </h1>
      <p className={dark ? "m-0 text-base leading-relaxed text-mist" : "m-0 text-base leading-relaxed text-ink-muted"}>{message}</p>
      <Button type="button" variant={dark ? "lime" : "primary"} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
