"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatInt } from "@/lib/data/format";
import type { Task } from "@/lib/data/types";
import { kindCounts, taskHeading, taskNote, type KindFilter } from "@/lib/walks/tasks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { KindMark } from "./KindMark";

const PAGE = 8;

export function TaskList({
  tasks,
  done,
  onToggle,
  onSelect,
  selectedId,
  block,
  clearHref,
  showGaps,
}: {
  tasks: Task[];
  done: ReadonlySet<string>;
  onToggle: (id: string, done: boolean) => void;
  onSelect: (task: Task) => void;
  selectedId: string | null;
  block: string | null;
  clearHref: string;
  showGaps: boolean;
}) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [page, setPage] = useState(0);
  const counts = useMemo(() => kindCounts(tasks), [tasks]);
  const gapsAvailable = showGaps && counts.gap > 0;
  const activeKind: KindFilter = kind === "gap" && !gapsAvailable ? "all" : kind;
  const visible = useMemo(
    () => (activeKind === "all" ? tasks : tasks.filter((task) => task.kind === activeKind)),
    [tasks, activeKind],
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE;
  const rows = visible.slice(start, start + PAGE);
  const doneCount = visible.reduce((total, task) => total + (done.has(task.id) ? 1 : 0), 0);

  useEffect(() => {
    setPage(0);
  }, [activeKind, block, tasks]);

  const filters: { id: KindFilter; label: string }[] = [
    { id: "all", label: "All" },
    ...(gapsAvailable ? [{ id: "gap" as const, label: `Gaps ${formatInt(counts.gap)}` }] : []),
    { id: "waste", label: `Waste ${formatInt(counts.waste)}` },
  ];

  return (
    <section id="tasks" aria-labelledby="tasks-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="tasks-heading" className="m-0 text-base font-semibold">
            Largest issues on this walk
          </h2>
          <p className="m-0 mt-1 text-[13px] text-ink-muted tabular-nums">{formatInt(doneCount)} done</p>
        </div>
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-1.5">
          {filters.map((filter) => {
            const selected = filter.id === activeKind;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setKind(filter.id)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-pill px-3 text-[13px]",
                  selected ? "bg-forest font-semibold text-dew" : "bg-paper text-forest",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>
      {block ? (
        <div>
          <span className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-paper pr-1 pl-4 text-sm">
            Block {block}
            <Link
              href={clearHref}
              scroll={false}
              aria-label={`Clear block ${block}`}
              className="inline-flex size-11 items-center justify-center rounded-full text-forest no-underline"
            >
              <X aria-hidden="true" size={16} strokeWidth={1.8} />
            </Link>
          </span>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-ink-muted">No tasks in this filter.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Field tasks">
          {rows.map((task) => {
            const selected = task.id === selectedId;
            const checked = done.has(task.id);
            return (
              <li
                key={task.id}
                className={cn(
                  "flex items-center gap-3 rounded-item bg-paper px-3.5 py-2",
                  selected && "ring-2 ring-budbreak",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(task)}
                  aria-current={selected ? "true" : undefined}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-item text-left"
                >
                  <KindMark kind={task.kind} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{taskHeading(task)}</span>
                    <span className="block truncate text-[13px] text-ink-muted">{taskNote(task.kind, "list")}</span>
                  </span>
                </button>
                <label className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[13px] text-ink-muted">
                  <input
                    type="checkbox"
                    className="size-[18px] accent-moss"
                    checked={checked}
                    onChange={(event) => onToggle(task.id, event.target.checked)}
                  />
                  Done
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {visible.length > PAGE ? (
        <nav aria-label="Task pages" className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            Previous
          </Button>
          <span className="text-[13px] text-ink-muted tabular-nums">
            {formatInt(start + 1)}–{formatInt(start + rows.length)} of {formatInt(visible.length)}
          </span>
          <Button variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
            Next
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
