"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { walkHref, type WalkRole } from "@/lib/walks/tasks";
import { cn } from "@/lib/utils";

const ORDER: WalkRole[] = ["inspector", "farmer"];

const LABEL: Record<WalkRole, string> = {
  inspector: "Inspector",
  farmer: "Farmer",
};

export function WalkTabs({ walk, block }: { walk: WalkRole; block: string | null }) {
  const router = useRouter();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key;
    if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return;
    event.preventDefault();
    const index = ORDER.indexOf(walk);
    const next =
      key === "Home" ? ORDER[0] : key === "End" ? ORDER[1] : ORDER[(index + (key === "ArrowRight" ? 1 : -1) + ORDER.length) % ORDER.length];
    document.getElementById(`walk-tab-${next}`)?.focus();
    if (next !== walk) router.push(walkHref(next, block), { scroll: false });
  }

  return (
    <div role="tablist" aria-label="Walk" onKeyDown={onKeyDown} className="inline-flex rounded-pill bg-paper p-1">
      {ORDER.map((role) => {
        const selected = role === walk;
        return (
          <Link
            key={role}
            id={`walk-tab-${role}`}
            href={walkHref(role, block)}
            role="tab"
            aria-selected={selected}
            aria-controls="walk-panel"
            tabIndex={selected ? 0 : -1}
            scroll={false}
            className={cn(
              "inline-flex h-11 items-center rounded-pill px-4 text-sm no-underline",
              selected ? "bg-forest font-semibold text-dew" : "text-forest",
            )}
          >
            {LABEL[role]}
          </Link>
        );
      })}
    </div>
  );
}
