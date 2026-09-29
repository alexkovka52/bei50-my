import { coverSlices, mowingCopy } from "@/components/overview/model";
import { Card } from "@/components/ui/Card";
import { StackBar } from "@/components/ui/StackBar";
import { formatInt } from "@/lib/data/format";
import type { CoverCounts } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function CoverCard({ cover }: { cover: CoverCounts }) {
  const slices = coverSlices(cover);
  return (
    <Card className="flex h-full flex-col gap-4">
      <h2 className="m-0 text-base font-semibold">Inter-row cover</h2>
      <StackBar
        label="Inter-row cover"
        segments={slices.map((slice) => ({ label: slice.label, value: Math.max(0, slice.count), color: slice.color }))}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(148px,1fr))] gap-x-4 gap-y-2 text-sm tabular-nums">
        {slices.map((slice) => (
          <div key={slice.label} className={cn("flex items-center gap-2", slice.muted && "text-ink-muted")}>
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{
                background: slice.color,
                boxShadow: slice.bordered ? "inset 0 0 0 1px #AEC3B0" : undefined,
              }}
            />
            {slice.label}, {formatInt(slice.count)}
          </div>
        ))}
      </div>
      <p className="m-0 text-sm leading-snug text-ink-muted">{mowingCopy(cover)}</p>
    </Card>
  );
}
