import Link from "next/link";
import { ForestPlaceholder } from "@/components/overview/ForestPlaceholder";
import { blockChip, frameZoom, previewSubtitle } from "@/components/overview/model";
import { PreviewMap } from "@/components/overview/PreviewMap";
import type { Block, Summary } from "@/lib/data/types";

export function PreviewCard({
  summary,
  block,
  disruptedRows,
}: {
  summary: Summary;
  block: Block | null;
  disruptedRows: number | null;
}) {
  const chip = block ? blockChip(block, disruptedRows) : null;
  const href = block ? `/map?block=${encodeURIComponent(block.id)}` : "/map";
  const frame = block ?? { centroid: summary.center, bbox: summary.bbox };

  return (
    <section aria-label="3D map preview" className="overview-preview relative isolate h-[560px] overflow-hidden rounded-[32px] bg-forest min-[1201px]:h-full min-[1201px]:min-h-[680px]">
      <ForestPlaceholder />
      <PreviewMap id={block?.id ?? null} center={frame.centroid} bbox={frame.bbox} zoom={frameZoom(frame.bbox)} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,#0F2A1D_0%,rgba(15,42,29,0.55)_26%,rgba(15,42,29,0)_52%)]"
      />
      <div className="absolute top-6 right-6 left-6 z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 font-display text-[26px] font-bold leading-none text-dew">Sireț3 in 3D</p>
          <p className="mt-1 mb-0 text-sm text-mist">{previewSubtitle(summary)}</p>
        </div>
        <Link
          href={href}
          className="inline-flex min-h-11 items-center rounded-pill bg-paper px-[18px] text-sm font-semibold text-forest no-underline"
        >
          Open map
        </Link>
      </div>
      {chip ? (
        <div className="absolute top-[46%] right-4 z-10 w-[200px] rounded-[18px] border border-[rgba(227,238,212,0.16)] bg-[rgba(15,42,29,0.78)] px-4 py-3.5 text-dew backdrop-blur-[14px] min-[701px]:right-6">
          <div className="text-[15px] font-semibold">{chip.title}</div>
          <div className="mt-0.5 text-[13px] text-mist">{chip.rowsKm}</div>
          <div className="mt-2.5 flex gap-3.5 text-[13px]">
            <span className="text-[#F2C06B]">{chip.disrupted}</span>
            <span className="text-[#F09A88]">{chip.waste}</span>
          </div>
        </div>
      ) : null}
      <div className="absolute right-4 bottom-16 left-4 z-20 flex flex-wrap gap-2 min-[701px]:right-6 min-[701px]:bottom-12 min-[701px]:left-6">
        <LegendChip swatch="circle" color="#E09A2D" label="Gaps" />
        <LegendChip swatch="square" color="#C9432F" label="Waste" />
        <LegendChip swatch="outline" color="#D6F26B" label="Selected block" />
      </div>
    </section>
  );
}

function LegendChip({ swatch, color, label }: { swatch: "circle" | "square" | "outline"; color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-[rgba(15,42,29,0.78)] px-3 py-2 text-[13px] text-dew">
      <span
        aria-hidden="true"
        className={swatch === "circle" ? "size-[9px] rounded-full" : "size-[9px] rounded-[2px]"}
        style={swatch === "outline" ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : { background: color }}
      />
      {label}
    </span>
  );
}
