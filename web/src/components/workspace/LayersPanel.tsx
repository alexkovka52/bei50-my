"use client";

import { Layers, X } from "lucide-react";
import type { ReactNode } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { formatInt } from "@/lib/data/format";
import type { LayerKey, LayerVisibility, MapCatalog } from "@/lib/workspace/map-state";
import { cn } from "@/lib/utils";
import { focusRing, glassButton } from "./styles";

type LayersPanelProps = {
  titleId: string;
  layers: LayerVisibility;
  counts: MapCatalog["counts"];
  exaggeration: number;
  opacity: number;
  variant: "dock" | "sheet";
  onToggle: (key: LayerKey, on: boolean) => void;
  onExaggeration: (value: number) => void;
  onOpacity: (value: number) => void;
  onClose: () => void;
  note?: string;
};

const swatch = "inline-block shrink-0";

export function LayersPanel({
  titleId,
  layers,
  counts,
  exaggeration,
  opacity,
  variant,
  onToggle,
  onExaggeration,
  onOpacity,
  onClose,
  note,
}: LayersPanelProps) {
  const rows: Array<{ key: LayerKey; label: string; count: number | null; mark: ReactNode }> = [
    { key: "plants", label: "Plants", count: counts.plants, mark: <span aria-hidden="true" className={cn(swatch, "size-2.5 rounded-[3px] bg-canopy")} /> },
    { key: "rows", label: "Rows", count: counts.rowPieces, mark: <span aria-hidden="true" className={cn(swatch, "h-[3px] w-3.5 rounded-[2px] bg-dew")} /> },
    { key: "interrows", label: "Inter-row cover", count: counts.interrows, mark: <span aria-hidden="true" className={cn(swatch, "size-2.5 rounded-[3px] bg-soil")} /> },
    { key: "gaps", label: "Gaps", count: counts.gaps, mark: <span aria-hidden="true" className={cn(swatch, "size-2.5 rounded-full bg-gap")} /> },
    { key: "waste", label: "Waste", count: counts.waste, mark: <span aria-hidden="true" className={cn(swatch, "size-2.5 rounded-[2px] bg-waste")} /> },
    {
      key: "paths",
      label: "Paths and forbidden zones",
      count: null,
      mark: <span aria-hidden="true" className={cn(swatch, "w-3.5 border-t-2 border-dashed border-dew")} />,
    },
  ];
  const percent = Math.round(opacity * 100);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold">
          <Layers aria-hidden="true" size={18} strokeWidth={1.8} />
          Layers
        </h2>
        <button type="button" className={glassButton} aria-label={variant === "sheet" ? "Close layers" : "Hide layers"} onClick={onClose}>
          <X aria-hidden="true" size={16} strokeWidth={2} />
        </button>
      </div>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.key} className="flex min-h-11 items-center justify-between gap-2 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
              {row.mark}
              {row.label}
            </span>
            <span className="flex items-center gap-2.5 text-mist tabular-nums">
              {row.count != null ? <span>{formatInt(row.count)}</span> : null}
              <Toggle checked={layers[row.key]} onChange={(on) => onToggle(row.key, on)} label={row.label} surface="dark" />
            </span>
          </li>
        ))}
      </ul>
      <div className="h-px bg-[rgba(227,238,212,0.12)]" />
      <label className="flex flex-col gap-1 text-[13px] text-mist">
        <span>Terrain height, {exaggeration.toFixed(1)}×</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={exaggeration}
          aria-valuetext={`${exaggeration.toFixed(1)} times`}
          onChange={(event) => onExaggeration(Math.round(Number(event.target.value) * 10) / 10)}
          className={cn("h-11 w-full accent-budbreak", focusRing)}
        />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-mist">
        <span>Drone imagery, {percent}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          aria-valuetext={`${percent} percent`}
          onChange={(event) => onOpacity(Number(event.target.value) / 100)}
          className={cn("h-11 w-full accent-budbreak", focusRing)}
        />
      </label>
      {note ? <p className="m-0 text-[13px] leading-snug text-mist">{note}</p> : null}
    </div>
  );
}
