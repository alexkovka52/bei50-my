import { formatDuration, formatInt, formatPct } from "@/lib/data/format";
import type { BBox, Block, CoverCounts, StructureCounts, Summary, Task, VineyardRow } from "@/lib/data/types";

export type NumberStat = {
  label: string;
  value: string;
  unit?: "km" | "ha" | "%";
  note: string;
};

export type CoverSlice = {
  label: string;
  count: number;
  color: string;
  muted: boolean;
  bordered: boolean;
};

export type TaskCard = {
  id: string;
  priority: number;
  title: string;
  detail: string;
  tone: "gap" | "waste";
};

export type BlockChip = {
  title: string;
  rowsKm: string;
  disrupted: string;
  waste: string;
};

function oneDecimal(n: number): string | null {
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
}

function counted(n: number, singular: string, plural: string): string {
  return `${formatInt(n)} ${n === 1 ? singular : plural}`;
}

export function statusHeadline(summary: Summary): string {
  const gaps = counted(summary.counts.gaps, "planting gap", "planting gaps");
  const waste = counted(summary.counts.waste, "waste item", "waste items");
  const blocks = counted(summary.counts.blocks, "block", "blocks");
  return `${gaps} and ${waste} are waiting across ${blocks}.`;
}

/** Two decimals, so 7,991.683 m stays 7.99 km rather than rounding to 8.0. */
export function formatWalkKm(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "Not measured";
  const km = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(meters / 1000);
  return `${km} km`;
}

export function statusDetail(summary: Summary): string {
  const walk = summary.walks.inspector;
  const km = formatWalkKm(walk.length_m);
  const duration = formatDuration(walk.length_m);
  const stops = walk.stops > 0 ? `, ${counted(walk.stops, "stop", "stops")}` : "";
  return `One inspector walk visits all of them: ${km}, about ${duration}${stops}.`;
}

/** Bare soil as a percent of inter-rows that received a cover class. */
export function bareSoilPercent(cover: CoverCounts): number | null {
  const assessed = cover.bare_soil + cover.vegetation + cover.mixed;
  if (assessed <= 0) return null;
  return (cover.bare_soil / assessed) * 100;
}

export function bareSoilNote(cover: CoverCounts): string {
  const pct = bareSoilPercent(cover);
  if (pct == null) return "Not measured";
  return `${formatPct(pct)} bare soil`;
}

/** Disrupted rows as a percent of rows that are regular or disrupted, nearest integer. */
export function disruptedShare(structure: StructureCounts): number | null {
  const assessed = structure.regular + structure.disrupted;
  if (assessed <= 0) return null;
  return Math.round((structure.disrupted / assessed) * 100);
}

export function numberStats(summary: Summary): NumberStat[] {
  const rows = oneDecimal(summary.row_km);
  const ground = oneDecimal(summary.interrow_ha);
  const canopy = oneDecimal(summary.canopy_ha);
  const disrupted = disruptedShare(summary.structure);
  return [
    {
      label: "Rows",
      value: rows ?? "Not measured",
      unit: rows ? "km" : undefined,
      note: counted(summary.counts.row_pieces, "row piece", "row pieces"),
    },
    {
      label: "Plants",
      value: formatInt(summary.counts.plants),
      note: canopy ? `${canopy} ha of canopy` : "Not measured",
    },
    {
      label: "Inter-row ground",
      value: ground ?? "Not measured",
      unit: ground ? "ha" : undefined,
      note: bareSoilNote(summary.cover),
    },
    {
      label: "Disrupted rows",
      value: disrupted == null ? "Not measured" : formatInt(disrupted),
      unit: disrupted == null ? undefined : "%",
      note: "a gap of 5 m or more",
    },
  ];
}

export function coverSlices(cover: CoverCounts): CoverSlice[] {
  return [
    { label: "Bare soil", count: cover.bare_soil, color: "#A9825A", muted: false, bordered: false },
    { label: "Mixed", count: cover.mixed, color: "#B4B65A", muted: false, bordered: false },
    { label: "Vegetation", count: cover.vegetation, color: "#6B9071", muted: false, bordered: false },
    {
      label: "Not assessed",
      count: cover.unset + cover.unassessable,
      color: "#D9E4CD",
      muted: true,
      bordered: true,
    },
  ];
}

export function mowingCopy(cover: CoverCounts): string {
  const grassy = cover.mixed + cover.vegetation;
  const line = `${counted(grassy, "inter-row carries", "inter-rows carry")} grass worth mowing before harvest traffic.`;
  const bare = bareSoilPercent(cover);
  if (bare != null && bare > 50) return `Mostly tilled. ${line}`;
  return line;
}

function formatMetres(metres: number): string {
  const rounded = Math.round(metres * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)} m`;
}

export function taskTitle(task: Task): string {
  if (task.kind === "waste") return task.block ? `Waste item, ${task.block}` : "Waste item";
  const length = task.gap_m != null && Number.isFinite(task.gap_m) ? formatMetres(task.gap_m) : null;
  const place = [task.block, task.row != null ? `row ${task.row}` : null].filter(Boolean).join(" ");
  const what = length ? `${length} gap` : "Planting gap";
  return place ? `${what}, ${place}` : what;
}

export function taskCards(tasks: Task[], limit = 3): TaskCard[] {
  return [...tasks]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit)
    .map((task) => ({
      id: task.id,
      priority: task.priority,
      title: taskTitle(task),
      detail: task.kind === "waste" ? "Collect before spraying" : "Check missing plants",
      tone: task.kind,
    }));
}

export function blockWithMostGaps(blocks: Block[]): Block | null {
  let best: Block | null = null;
  for (const block of blocks) {
    if (
      !best ||
      block.gaps > best.gaps ||
      (block.gaps === best.gaps && block.waste > best.waste) ||
      (block.gaps === best.gaps && block.waste === best.waste && block.id < best.id)
    ) {
      best = block;
    }
  }
  return best;
}

export function disruptedRowCount(rows: VineyardRow[], blockId: string): number {
  return rows.reduce((count, row) => count + (row.block === blockId && row.structure === "disrupted" ? 1 : 0), 0);
}

export function blockChip(block: Block, disruptedRows: number | null): BlockChip {
  const km = oneDecimal(block.row_km);
  return {
    title: `Block ${block.id}`,
    rowsKm: km ? `${formatInt(block.rows)} rows, ${km} km` : `${formatInt(block.rows)} rows`,
    disrupted: disruptedRows == null ? "Not measured" : `${formatInt(disruptedRows)} disrupted`,
    waste: `${formatInt(block.waste)} waste`,
  };
}

export function previewSubtitle(summary: Summary): string {
  const ha = Number.isFinite(summary.area_ha) ? `${formatInt(summary.area_ha)} ha` : "Not measured";
  const tiles = Number.isFinite(summary.tiles) ? `${formatInt(summary.tiles)} tiles` : "Not measured";
  const cm = Number.isFinite(summary.gsd_m) ? oneDecimal(summary.gsd_m * 100) : null;
  return `${ha}, ${tiles} at ${cm ? `${cm} cm` : "Not measured"}`;
}

/** Starting zoom for a block bbox in the preview card, before fitBounds settles. */
export function frameZoom(bbox: BBox): number {
  const [west, south, east, north] = bbox;
  if (!(east > west) || !(north > south)) return 15;
  const lat = ((south + north) / 2) * (Math.PI / 180);
  const span = Math.max(Math.abs(east - west) * Math.cos(lat), north - south);
  if (span <= 0) return 15;
  const zoom = Math.log2(360 / span) - 2.4;
  return Math.min(16.5, Math.max(13, Math.round(zoom * 10) / 10));
}
