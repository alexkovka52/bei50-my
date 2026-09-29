"use client";

import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { formatHa, formatInt, formatPct } from "@/lib/data/format";
import type { Block, LargestGap } from "@/lib/data/types";
import {
  formatGapMeters,
  formatRowLength,
  rowNumberFromId,
  structureBar,
  structureLabel,
  type Selection,
  walkHref,
  wasteSummary,
} from "@/lib/workspace/map-state";
import { cn } from "@/lib/utils";
import { focusRing } from "./styles";

type InspectorProps = {
  selection: Selection;
  block: Block | null;
  onClose: () => void;
  onFlyGap: (gap: LargestGap) => void;
  onSelectBlock: (id: string) => void;
};

export function Inspector({ selection, block, onClose, onFlyGap, onSelectBlock }: InspectorProps) {
  if (selection.kind === "block" && block) return <BlockInspector block={block} onClose={onClose} onFlyGap={onFlyGap} />;
  if (selection.kind === "gap") return <GapCard selection={selection} onClose={onClose} onSelectBlock={onSelectBlock} />;
  if (selection.kind === "row") return <RowCard selection={selection} onClose={onClose} onSelectBlock={onSelectBlock} />;
  if (selection.kind === "waste") return <WasteCard selection={selection} onClose={onClose} onSelectBlock={onSelectBlock} />;
  return null;
}

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <aside
        aria-label={label}
        className="absolute top-[88px] right-5 z-20 hidden max-h-[calc(100dvh-7.5rem)] w-[340px] overflow-y-auto rounded-panel border border-[rgba(227,238,212,0.14)] bg-[rgba(15,42,29,0.8)] p-5 text-dew backdrop-blur-[16px] min-[1025px]:block"
      >
        {children}
      </aside>
      <section
        aria-label={label}
        className="absolute inset-x-4 bottom-4 z-30 rounded-[26px] border border-[rgba(227,238,212,0.14)] bg-[rgba(15,42,29,0.84)] px-[22px] pt-7 pb-[18px] text-dew backdrop-blur-[16px] min-[1025px]:hidden max-[640px]:inset-x-0 max-[640px]:bottom-0 max-[640px]:rounded-b-none"
      >
        <span aria-hidden="true" className="absolute top-2 left-1/2 h-[5px] w-10 -translate-x-1/2 rounded-pill bg-[rgba(227,238,212,0.3)]" />
        {children}
      </section>
    </>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="map-close size-11 shrink-0 items-center justify-center rounded-full border border-[rgba(227,238,212,0.14)] bg-[rgba(227,238,212,0.1)] text-dew backdrop-blur-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-budbreak"
      aria-label="Close"
      onClick={onClose}
    >
      <X aria-hidden="true" size={16} strokeWidth={2} />
    </button>
  );
}

function BlockInspector({ block, onClose, onFlyGap }: { block: Block; onClose: () => void; onFlyGap: (gap: LargestGap) => void }) {
  const bar = structureBar(block.disrupted_pct);
  const waste = wasteSummary(block.waste);
  const summary = `${formatInt(block.rows)} rows, ${formatRowLength(block.row_km)}`;
  return (
    <Frame label={`Block ${block.id}`}>
      <div className="flex flex-row flex-wrap items-center gap-6 max-[640px]:flex-col max-[640px]:items-stretch min-[1025px]:flex-col min-[1025px]:items-stretch min-[1025px]:gap-4">
      <div className="flex min-w-[180px] items-start justify-between gap-3 min-[1025px]:min-w-0">
        <div>
          <h2 className="font-display text-[28px] leading-none font-bold tracking-[-0.5px] min-[1025px]:text-[30px]">Block {block.id}</h2>
          <p className="mt-1 hidden text-[13px] text-mist min-[1025px]:block">Selected on the map</p>
          <p className="mt-1 text-[13px] text-mist min-[1025px]:hidden">{summary}</p>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <div className="hidden grid-cols-2 gap-3.5 tabular-nums min-[1025px]:grid">
        <DarkStat label="Rows" value={formatInt(block.rows)} />
        <DarkStat label="Row length" value={formatRowLength(block.row_km)} />
        <DarkStat label="Plants" value={formatInt(block.plants)} />
        <DarkStat label="Inter-row" value={formatHa(block.interrow_ha)} />
      </div>
      <div className="flex flex-wrap gap-6 tabular-nums min-[1025px]:hidden">
        <DarkStat label="Plants" value={formatInt(block.plants)} size="sheet" />
        <DarkStat label="Gaps" value={formatInt(block.gaps)} size="sheet" valueClassName="text-[#F2C06B]" />
        <DarkStat label="Waste" value={formatInt(block.waste)} size="sheet" valueClassName="text-[#F09A88]" />
        <DarkStat
          label="Disrupted"
          value={block.disrupted_pct == null ? "Not measured" : formatPct(block.disrupted_pct)}
          size="sheet"
        />
      </div>
      <div className="hidden flex-col gap-2 min-[1025px]:flex">
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span>Row structure</span>
          <span className="text-mist">{bar.caption}</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-pill bg-[rgba(227,238,212,0.12)]" aria-hidden="true">
          {bar.caption === "Not measured" ? null : (
            <>
              <div style={{ width: `${bar.regular}%`, background: "#6B9071" }} />
              <div style={{ width: `${bar.disrupted}%`, background: "#E09A2D" }} />
            </>
          )}
        </div>
      </div>
      <div className="hidden flex-col min-[1025px]:flex">
        <div className="text-[13px] text-mist">Largest gaps here</div>
        {block.largest_gaps.length === 0 ? <p className="mt-2 text-sm text-mist">No large gaps recorded</p> : null}
        {block.largest_gaps.map((gap) => (
          <button
            key={gap.row_id}
            type="button"
            onClick={() => onFlyGap(gap)}
            aria-label={`Fly to row ${gap.row}, ${formatGapMeters(gap.gap_m)} gap`}
            className={cn(
              "flex min-h-11 items-center justify-between gap-3 border-b border-[rgba(227,238,212,0.1)] text-left text-sm last:border-b-0",
              focusRing,
            )}
          >
            <span>Row {gap.row}</span>
            <span className="tabular-nums text-[#F2C06B]">{formatGapMeters(gap.gap_m)} gap</span>
          </button>
        ))}
        <div className="flex min-h-11 items-center justify-between text-sm">
          <span>{waste.label}</span>
          {waste.action ? <span className="text-[#F09A88]">{waste.action}</span> : null}
        </div>
      </div>
      <div className="ml-auto flex gap-2.5 max-[640px]:ml-0 max-[640px]:w-full max-[640px]:flex-col min-[1025px]:ml-0 min-[1025px]:w-full">
        <Button href={walkHref(block.id, null)} variant="lime" className="flex-1">
          Walk this block
        </Button>
        <Link
          href={`/blocks/${block.id}`}
          className={cn(
            "hidden min-h-11 flex-1 items-center justify-center rounded-pill border border-[rgba(227,238,212,0.3)] text-sm font-semibold text-dew no-underline hover:text-budbreak min-[1025px]:inline-flex",
            focusRing,
          )}
        >
          Block details
        </Link>
      </div>
      </div>
    </Frame>
  );
}

function GapCard({
  selection,
  onClose,
  onSelectBlock,
}: {
  selection: Extract<Selection, { kind: "gap" }>;
  onClose: () => void;
  onSelectBlock: (id: string) => void;
}) {
  const rowNumber = rowNumberFromId(selection.rowId);
  return (
    <Frame label={`${formatGapMeters(selection.gapM)} gap`}>
      <FeatureBody
        title={`${formatGapMeters(selection.gapM)} gap`}
        lines={[rowNumber ? `Row ${rowNumber}` : selection.rowId, selection.rowId]}
        onClose={onClose}
        action={<Button href={walkHref(selection.blockId || null, selection.rowId)} variant="lime" className="w-full">Show on walk</Button>}
        blockId={selection.blockId}
        onSelectBlock={onSelectBlock}
      />
    </Frame>
  );
}

function RowCard({
  selection,
  onClose,
  onSelectBlock,
}: {
  selection: Extract<Selection, { kind: "row" }>;
  onClose: () => void;
  onSelectBlock: (id: string) => void;
}) {
  const rowNumber = rowNumberFromId(selection.id);
  return (
    <Frame label={`Row ${selection.id}`}>
      <FeatureBody
        title={rowNumber ? `Row ${rowNumber}` : selection.id}
        lines={[selection.id, structureLabel(selection.structure)]}
        onClose={onClose}
        action={<Button href={walkHref(selection.blockId || null, selection.id)} variant="lime" className="w-full">Show on walk</Button>}
        blockId={selection.blockId}
        onSelectBlock={onSelectBlock}
      />
    </Frame>
  );
}

function WasteCard({
  selection,
  onClose,
  onSelectBlock,
}: {
  selection: Extract<Selection, { kind: "waste" }>;
  onClose: () => void;
  onSelectBlock: (id: string) => void;
}) {
  return (
    <Frame label="Waste">
      <FeatureBody
        title="Waste"
        lines={[selection.id, selection.blockId ? `Block ${selection.blockId}` : "Outside the blocks"]}
        onClose={onClose}
        action={<Button href={walkHref(selection.blockId, null)} variant="lime" className="w-full">Show on walk</Button>}
        blockId={selection.blockId ?? ""}
        onSelectBlock={onSelectBlock}
      />
    </Frame>
  );
}

function FeatureBody({
  title,
  lines,
  onClose,
  action,
  blockId,
  onSelectBlock,
}: {
  title: string;
  lines: string[];
  onClose: () => void;
  action: ReactNode;
  blockId: string;
  onSelectBlock: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[26px] leading-none font-bold tracking-[-0.5px]">{title}</h2>
          {lines.map((line) => (
            <p key={line} className="mt-1 text-[13px] text-mist">
              {line}
            </p>
          ))}
        </div>
        <CloseButton onClose={onClose} />
      </div>
      {blockId ? (
        <button
          type="button"
          onClick={() => onSelectBlock(blockId)}
          className={cn("min-h-11 self-start text-sm font-semibold text-dew", focusRing)}
        >
          Show block {blockId}
        </button>
      ) : null}
      {action}
    </div>
  );
}

function DarkStat({ label, value, valueClassName, size = "desk" }: { label: string; value: string; valueClassName?: string; size?: "desk" | "sheet" }) {
  return (
    <div>
      <div className="text-xs text-mist">{label}</div>
      <div className={cn("font-semibold tabular-nums", size === "desk" ? "text-[22px]" : "text-xl", valueClassName)}>{value}</div>
    </div>
  );
}
