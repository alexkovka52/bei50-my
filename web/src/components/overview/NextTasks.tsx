import Link from "next/link";
import { taskCards } from "@/components/overview/model";
import { formatInt } from "@/lib/data/format";
import type { Task } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const TONE = {
  gap: "bg-[rgba(224,154,45,0.16)] text-[#9A6112]",
  waste: "bg-[rgba(201,67,47,0.14)] text-[#A1321F]",
} as const;

export function NextTasks({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return null;
  const cards = taskCards(tasks, 3);
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-base font-semibold">Next on the walk</h2>
        <Link href="/walks#tasks" className="inline-flex min-h-11 items-center text-sm font-semibold no-underline">
          All {formatInt(tasks.length)} tasks
        </Link>
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[701px]:grid-cols-3">
        {cards.map((card) => (
          <li key={card.id}>
            <article className="flex h-full items-center gap-3 rounded-[20px] bg-paper px-4 py-3.5">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums", TONE[card.tone])}>
                {card.priority}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{card.title}</div>
                <div className="text-[13px] text-ink-muted">{card.detail}</div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
