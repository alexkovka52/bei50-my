import type { Block, CoverCounts, RowStructure, VineyardRow } from "../data/types.ts";

const NOT_MEASURED = "Not measured";

const rowKmFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const metreFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export type BlockSortKey = "id" | "rows" | "row_km" | "plants" | "disrupted_pct" | "gaps" | "waste" | "interrow_ha";
export type SortDirection = "asc" | "desc";
export type BlockSort = { key: BlockSortKey; direction: SortDirection };

const HEADING: Record<BlockSortKey, Record<SortDirection, string>> = {
  id: { asc: "block id ascending", desc: "block id descending" },
  rows: { asc: "fewest rows first", desc: "most rows first" },
  row_km: { asc: "shortest rows first", desc: "longest rows first" },
  plants: { asc: "fewest plants first", desc: "most plants first" },
  disrupted_pct: { asc: "least disrupted first", desc: "most disrupted first" },
  gaps: { asc: "fewest gaps first", desc: "most gaps first" },
  waste: { asc: "least waste first", desc: "most waste first" },
  interrow_ha: { asc: "least inter-row first", desc: "most inter-row first" },
};

const COVER_ORDER: { key: keyof CoverCounts; label: string }[] = [
  { key: "bare_soil", label: "Bare" },
  { key: "vegetation", label: "Vegetation" },
  { key: "mixed", label: "Mixed" },
  { key: "unassessable", label: "Unassessable" },
  { key: "unset", label: "Not assessed" },
];

export type CoverPart = { key: keyof CoverCounts; label: string; value: number };

function compareId(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

function numericValue(block: Block, key: Exclude<BlockSortKey, "id">): number | null {
  const value = block[key];
  if (value === null || !Number.isFinite(value)) return null;
  return value;
}

export function sortBlocks(blocks: readonly Block[], key: BlockSortKey, direction: SortDirection): Block[] {
  const sign = direction === "asc" ? 1 : -1;
  return blocks.slice().sort((a, b) => {
    if (key === "id") return sign * compareId(a.id, b.id);
    const left = numericValue(a, key);
    const right = numericValue(b, key);
    if (left === null && right === null) return compareId(a.id, b.id);
    if (left === null) return 1;
    if (right === null) return -1;
    if (left === right) return compareId(a.id, b.id);
    return (left - right) * sign;
  });
}

export function nextSort(current: BlockSort, key: BlockSortKey): BlockSort {
  if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: key === "id" ? "asc" : "desc" };
}

export function blocksHeadingCount(count: number, sort: BlockSort): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  const noun = safe === 1 ? "block" : "blocks";
  return `${safe} ${noun}, ${HEADING[sort.key][sort.direction]}`;
}

export function filterBlocks(blocks: readonly Block[], query: string): Block[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return blocks.slice();
  return blocks.filter((block) => block.id.toLowerCase().includes(needle));
}

function csvNumber(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "";
  const factor = 10 ** digits;
  return String(Math.round(value * factor) / factor);
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function blocksToCsv(blocks: readonly Block[]): string {
  const header = "Block,Rows,Row length (km),Plants,Disrupted rows (%),Gaps,Waste,Inter-row (ha)";
  const lines = blocks.map((block) =>
    [
      csvCell(block.id),
      csvNumber(block.rows, 0),
      csvNumber(block.row_km, 2),
      csvNumber(block.plants, 0),
      block.disrupted_pct === null ? "" : csvNumber(block.disrupted_pct, 1),
      csvNumber(block.gaps, 0),
      csvNumber(block.waste, 0),
      csvNumber(block.interrow_ha, 2),
    ].join(","),
  );
  return [header, ...lines, ""].join("\n");
}

/** Regular or disrupted. Unset and unassessable rows are not a known structure. */
export function isKnownStructure(structure: RowStructure): structure is "regular" | "disrupted" {
  return structure === "regular" || structure === "disrupted";
}

/**
 * Disrupted rows as a percent of aggregated rows with a known structure.
 * `blockId` limits the count to one block. Null when none of those rows were classified.
 */
export function disruptedRowShare(rows: readonly VineyardRow[], blockId?: string | null): number | null {
  let disrupted = 0;
  let known = 0;
  for (const row of rows) {
    if (blockId != null && row.block !== blockId) continue;
    if (!isKnownStructure(row.structure)) continue;
    known += 1;
    if (row.structure === "disrupted") disrupted += 1;
  }
  if (known <= 0) return null;
  return Math.round((disrupted / known) * 100);
}

/** Replace each block's piece-based disruption with the aggregated-row share. */
export function blocksWithRowDisruption(blocks: readonly Block[], rows: readonly VineyardRow[]): Block[] {
  return blocks.map((block) => ({ ...block, disrupted_pct: disruptedRowShare(rows, block.id) }));
}

export function findBlock(blocks: readonly Block[], id: string): Block | null {
  const needle = id.trim().toLowerCase();
  if (!needle) return null;
  return blocks.find((block) => block.id.toLowerCase() === needle) ?? null;
}

export function selectedBlockId(blocks: readonly Block[], requested: string | null | undefined): string | null {
  if (blocks.length === 0) return null;
  const needle = requested?.trim().toLowerCase();
  if (needle) {
    const found = blocks.find((block) => block.id.toLowerCase() === needle);
    if (found) return found.id;
  }
  return blocks[0]?.id ?? null;
}

export function coverParts(cover: CoverCounts): CoverPart[] {
  return COVER_ORDER.flatMap((item) => {
    const value = cover[item.key];
    if (!Number.isFinite(value) || value <= 0) return [];
    return [{ key: item.key, label: item.label, value }];
  });
}

export function formatRowKm(rowKm: number): string {
  if (!Number.isFinite(rowKm) || rowKm < 0) return NOT_MEASURED;
  return `${rowKmFormat.format(rowKm)} km`;
}

export function formatMetres(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return NOT_MEASURED;
  return `${metreFormat.format(meters)} m`;
}

export function formatDisrupted(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) return NOT_MEASURED;
  return `${percentFormat.format(percent)}%`;
}

export function structureLabel(structure: RowStructure): string {
  if (structure === "regular") return "Regular";
  if (structure === "disrupted") return "Disrupted";
  if (structure === "unassessable") return "Unassessable";
  return NOT_MEASURED;
}

export function rowsForBlock(rows: readonly VineyardRow[], blockId: string): VineyardRow[] {
  return rows.filter((row) => row.block === blockId).slice().sort((a, b) => a.row - b.row || compareId(a.id, b.id));
}
