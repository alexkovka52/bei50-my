import type { NumberStat } from "@/components/overview/model";
import { cn } from "@/lib/utils";

function cellClass(index: number): string {
  const leftColumn = index % 2 === 0;
  const firstRow = index < 2;
  const desktopDivider = index < 3;
  return cn(
    "min-w-0",
    leftColumn && "max-[700px]:border-r max-[700px]:border-lichen max-[700px]:pr-3",
    !leftColumn && "max-[700px]:pl-3",
    firstRow && "max-[700px]:border-b max-[700px]:border-lichen max-[700px]:pb-4",
    !firstRow && "max-[700px]:pt-4",
    desktopDivider && "min-[701px]:border-r min-[701px]:border-lichen",
    index === 0 && "min-[701px]:pr-[22px] min-[701px]:pl-1",
    index > 0 && index < 3 && "min-[701px]:px-[22px]",
    index === 3 && "min-[701px]:pr-1 min-[701px]:pl-[22px]",
  );
}

export function NumbersStrip({ stats }: { stats: NumberStat[] }) {
  return (
    <section aria-label="Vineyard in numbers" className="grid grid-cols-2 min-[701px]:grid-cols-4">
      {stats.map((stat, index) => (
        <div key={stat.label} className={cellClass(index)}>
          <div className="text-sm text-ink-muted">{stat.label}</div>
          <div className="font-display text-[26px] font-bold leading-none tracking-[-1px] text-forest tabular-nums min-[701px]:text-[40px]">
            {stat.value}
            {stat.unit ? (
              <span className="text-[16px] font-semibold min-[701px]:text-[20px]">{stat.unit === "%" ? "%" : ` ${stat.unit}`}</span>
            ) : null}
          </div>
          <div className="mt-1 text-[13px] text-ink-muted">{stat.note}</div>
        </div>
      ))}
    </section>
  );
}
