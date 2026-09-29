"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { walkHref, type WalkRole } from "@/lib/walks/tasks";
import { cn } from "@/lib/utils";

const ORDER: WalkRole[] = ["inspector", "farmer"];

const LABEL: Record<WalkRole, string> = {
  inspector: "Inspector",
  farmer: "Farmer",
};

export function WalkTabs({
  walk,
  block,
  onSelect,
  idPrefix,
  panelId,
}: {
  walk: WalkRole;
  block: string | null;
  onSelect: (walk: WalkRole) => void;
  idPrefix: string;
  panelId: string;
}) {
  const pending = useRef<WalkRole | null>(null);

  useEffect(() => {
    if (pending.current !== walk) return;
    pending.current = null;
    document.getElementById(`${idPrefix}-${walk}`)?.focus();
  }, [walk, idPrefix]);

  function choose(next: WalkRole) {
    if (next === walk) {
      document.getElementById(`${idPrefix}-${next}`)?.focus();
      return;
    }
    pending.current = next;
    onSelect(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key;
    if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return;
    event.preventDefault();
    const index = ORDER.indexOf(walk);
    const next =
      key === "Home"
        ? ORDER[0]
        : key === "End"
          ? ORDER[ORDER.length - 1]
          : ORDER[(index + (key === "ArrowRight" ? 1 : -1) + ORDER.length) % ORDER.length];
    if (next) choose(next);
  }

  function onClick(event: MouseEvent<HTMLAnchorElement>, role: WalkRole) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    choose(role);
  }

  return (
    <div role="tablist" aria-label="Walk" onKeyDown={onKeyDown} className="inline-flex rounded-pill bg-paper p-1">
      {ORDER.map((role) => {
        const selected = role === walk;
        return (
          <Link
            key={role}
            id={`${idPrefix}-${role}`}
            href={walkHref(role, block)}
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            scroll={false}
            onClick={(event) => onClick(event, role)}
            className={cn(
              "inline-flex h-11 items-center rounded-pill px-3 text-sm no-underline min-[481px]:px-4",
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
