import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  heading: string;
  children: ReactNode;
  tone?: "light" | "dark";
  level?: "h1" | "h2";
};

export function EmptyState({ heading, children, tone = "light", level = "h2" }: EmptyStateProps) {
  const dark = tone === "dark";
  const titleClass = cn("m-0 font-display text-[28px] font-bold tracking-[-0.5px]", dark ? "text-dew" : "text-forest");
  const body = (
    <>
      {level === "h1" ? <h1 className={titleClass}>{heading}</h1> : <h2 className={titleClass}>{heading}</h2>}
      <p className={cn("mt-3 max-w-xl text-base leading-relaxed", dark ? "text-mist" : "text-ink-muted")}>{children}</p>
    </>
  );
  if (dark) return <div className="max-w-2xl">{body}</div>;
  return <Card className="max-w-2xl">{body}</Card>;
}
