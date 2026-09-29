import Link from "next/link";
import type { Block } from "@/lib/data/types";
import { coverParts, formatDisrupted, formatMetres, formatRowKm } from "@/lib/blocks/blocks";
import { formatInt } from "@/lib/data/format";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const COVER_COLOR: Record<ReturnType<typeof coverParts>[number]["key"], string> = {
  bare_soil: "var(--color-soil)",
  vegetation: "var(--color-vegetation)",
  mixed: "var(--color-mixed)",
  unassessable: "var(--color-ink-muted)",
  unset: "var(--color-unset)",
};

type BlockFactsProps = {
  block: Block;
  level?: "h1" | "h2";
  linkToPage?: boolean;
};

export function BlockFacts({ block, level = "h2", linkToPage = false }: BlockFactsProps) {
  const Title = level;
  const parts = coverParts(block.cover);
  const coverTotal = parts.reduce((sum, part) => sum + part.value, 0);
  const coverText =
    parts.length > 0 ? parts.map((part) => `${part.label} ${formatInt(part.value)}`).join(", ") : "Not measured";
  const title = `Block ${block.id}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Title className="m-0 font-display text-[30px] font-bold leading-none tracking-[-0.5px]">
          {linkToPage ? (
            <Link href={`/blocks/${block.id}`} className="text-forest no-underline hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </Title>
        <p className="mt-1.5 mb-0 text-sm text-ink-muted">
          {formatInt(block.rows)} rows over {formatRowKm(block.row_km)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Plants" value={formatInt(block.plants)} />
        <Stat label="Gaps" value={formatInt(block.gaps)} />
        <Stat label="Waste" value={formatInt(block.waste)} emphasize={block.waste > 0} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[13px] text-ink-muted">Inter-row cover</div>
        {coverTotal > 0 ? (
          <>
            <div className="flex h-2.5 overflow-hidden rounded-pill" role="img" aria-label={`Inter-row cover: ${coverText}`}>
              {parts.map((part) => (
                <div
                  key={part.key}
                  style={{ width: `${(part.value / coverTotal) * 100}%`, background: COVER_COLOR[part.key] }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px]">
              {parts.map((part) => (
                <span key={part.key} className={part.key === "unset" || part.key === "unassessable" ? "text-ink-muted" : undefined}>
                  {part.label} {formatInt(part.value)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="m-0 text-sm text-ink-muted">Not measured</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-[13px] text-ink-muted">Largest gaps</div>
        {block.largest_gaps.length > 0 ? (
          <ul className="m-0 list-none p-0">
            {block.largest_gaps.map((gap) => (
              <li key={gap.row_id} className="flex justify-between border-b border-line py-[7px] text-sm last:border-b-0">
                <span>Row {formatInt(gap.row)}</span>
                <span>{formatMetres(gap.gap_m)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-ink-muted">{block.gaps === 0 ? "No gaps in this block" : "Not measured"}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 min-[700px]:grid-cols-2">
        <Button href={`/map?block=${encodeURIComponent(block.id)}`} className="w-full">
          Show on map
        </Button>
        <Button href={`/walks?block=${encodeURIComponent(block.id)}`} variant="outline" className="w-full">
          Walk this block
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={cn("mt-0.5 text-xl font-semibold tabular-nums", emphasize ? "text-[#A1321F]" : "text-forest")}>{value}</div>
    </div>
  );
}

export function DisruptedBar({ percent }: { percent: number | null }) {
  if (percent === null || !Number.isFinite(percent)) {
    return <span className="text-ink-muted">Not measured</span>;
  }
  const width = Math.min(100, Math.max(0, percent));
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="block h-1.5 w-[90px] shrink-0 overflow-hidden rounded-pill bg-line" aria-hidden="true">
        <span className="block h-full rounded-pill bg-gap" style={{ width: `${width}%` }} />
      </span>
      {formatDisrupted(percent)}
    </span>
  );
}
