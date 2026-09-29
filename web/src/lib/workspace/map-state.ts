import type { BBox, Block, LayerName, LonLat, RowStructure, Summary, VineyardRow } from "../data/types";

export const LAYER_KEYS = ["plants", "rows", "interrows", "gaps", "waste", "paths"] as const;
export type LayerKey = (typeof LAYER_KEYS)[number];
export type LayerVisibility = Record<LayerKey, boolean>;

export const LAYERS_STORAGE_KEY = "dementra-map-layers";
export const LAYERS_COLLAPSED_KEY = "dementra-map-layers-collapsed";

/** Matches the map style defaults: paths and inter-row cover start off. */
export const DEFAULT_LAYERS: LayerVisibility = {
  plants: true,
  rows: true,
  interrows: false,
  gaps: true,
  waste: true,
  paths: false,
};

export type MapQuery =
  | { kind: "block"; id: string }
  | { kind: "row"; id: string; blockId: string; row: number };

export type CatalogGap = { id: string; gapM: number; at: LonLat };

export type CatalogRow = {
  id: string;
  block: string;
  row: number;
  structure: RowStructure;
  at: LonLat | null;
  gap: CatalogGap | null;
};

export type CatalogWaste = {
  id: string;
  block: string | null;
  at: LonLat;
};

export type MapCatalog = {
  farm: string;
  flownOn: string;
  center: LonLat;
  bbox: BBox;
  counts: {
    plants: number;
    /** Row pieces, the strokes drawn on the map. `counts.rows` is the aggregated row count. */
    rowPieces: number;
    interrows: number;
    gaps: number;
    waste: number;
  };
  blocks: Block[];
  rows: CatalogRow[];
  waste: CatalogWaste[];
};

export type BlockSelection = { kind: "block"; id: string };
export type GapSelection = {
  kind: "gap";
  id: string;
  blockId: string;
  rowId: string;
  gapM: number;
  at: LonLat;
};
export type RowSelection = {
  kind: "row";
  id: string;
  blockId: string;
  structure: RowStructure;
  at: LonLat | null;
};
export type WasteSelection = { kind: "waste"; id: string; blockId: string | null; at: LonLat };
export type Selection = BlockSelection | GapSelection | RowSelection | WasteSelection;

export type MapLocation = {
  layers: LayerVisibility | null;
  blockId: string | null;
  rowId: string | null;
};

export type CameraTarget = { kind: "point"; at: LonLat } | { kind: "bounds"; bbox: BBox };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const SCALE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000] as const;

export function encodeLayers(layers: LayerVisibility): string {
  return LAYER_KEYS.filter((key) => layers[key]).join(",");
}

export function decodeLayers(value: string): LayerVisibility {
  const on = new Set(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
  return {
    plants: on.has("plants"),
    rows: on.has("rows"),
    interrows: on.has("interrows"),
    gaps: on.has("gaps"),
    waste: on.has("waste"),
    paths: on.has("paths"),
  };
}

export function layerVisibilityToMap(layers: LayerVisibility): Record<LayerName, boolean> {
  return {
    plants: layers.plants,
    rows: layers.rows,
    interrows: layers.interrows,
    gaps: layers.gaps,
    waste: layers.waste,
    passages: layers.paths,
    forbidden: layers.paths,
    blocks: true,
  };
}

function blockToken(blockNumber: number): string {
  return `V${String(blockNumber).padStart(2, "0")}`;
}

function rowToken(blockNumber: number, rowNumber: number): string {
  return `${blockToken(blockNumber)}-R${String(rowNumber).padStart(3, "0")}`;
}

/** Block id (`V04`, `v4`) or row (`V04-R032`, `V04 row 32`). */
export function parseMapQuery(input: string): MapQuery | null {
  const cleaned = input.trim().replace(/\s+/g, " ").replace(/^block\s+/i, "");
  if (!cleaned) return null;

  const rowWords = /^v0*(\d{1,3}) row 0*(\d{1,3})$/i.exec(cleaned);
  const rowId = /^v0*(\d{1,3})\s*-\s*r0*(\d{1,3})$/i.exec(cleaned);
  const rowMatch = rowWords ?? rowId;
  if (rowMatch) {
    const blockNumber = Number(rowMatch[1]);
    const rowNumber = Number(rowMatch[2]);
    if (blockNumber < 1 || rowNumber < 1) return null;
    return { kind: "row", id: rowToken(blockNumber, rowNumber), blockId: blockToken(blockNumber), row: rowNumber };
  }

  const blockMatch = /^v0*(\d{1,3})$/i.exec(cleaned);
  if (!blockMatch) return null;
  const blockNumber = Number(blockMatch[1]);
  if (blockNumber < 1) return null;
  return { kind: "block", id: blockToken(blockNumber) };
}

export function canonicalizeBlockId(value: string | null): string | null {
  if (!value) return null;
  const parsed = parseMapQuery(value);
  return parsed?.kind === "block" ? parsed.id : null;
}

export function canonicalizeRowId(value: string | null): string | null {
  if (!value) return null;
  const parsed = parseMapQuery(value);
  return parsed?.kind === "row" ? parsed.id : null;
}

export function resolveQuery(input: string, blockIds: readonly string[], rowIds: readonly string[]): MapQuery | null {
  const parsed = parseMapQuery(input);
  if (!parsed) return null;
  if (parsed.kind === "block") return blockIds.includes(parsed.id) ? parsed : null;
  return rowIds.includes(parsed.id) ? parsed : null;
}

export function mapSearchString(state: { layers: LayerVisibility; blockId: string | null; rowId: string | null }): string {
  const params = new URLSearchParams();
  const encoded = encodeLayers(state.layers);
  if (encoded !== encodeLayers(DEFAULT_LAYERS)) params.set("layers", encoded);
  if (state.blockId) params.set("block", state.blockId);
  if (state.rowId) params.set("row", state.rowId);
  return params.toString();
}

export function parseMapSearch(search: string): MapLocation {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const rowId = canonicalizeRowId(params.get("row"));
  const blockFromRow = rowId ? parseMapQuery(rowId) : null;
  const blockId = blockFromRow?.kind === "row" ? blockFromRow.blockId : canonicalizeBlockId(params.get("block"));
  return {
    layers: params.has("layers") ? decodeLayers(params.get("layers") ?? "") : null,
    blockId,
    rowId,
  };
}

export function searchFromRecord(record: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const key of ["layers", "block", "row"] as const) {
    const value = record[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") params.set(key, first);
  }
  return params.toString();
}

export function selectionForLocation(location: MapLocation, rows: readonly CatalogRow[], blockIds: readonly string[]): Selection | null {
  if (location.rowId) {
    const row = rows.find((item) => item.id === location.rowId);
    if (row?.gap) {
      return {
        kind: "gap",
        id: row.gap.id,
        blockId: row.block,
        rowId: row.id,
        gapM: row.gap.gapM,
        at: row.gap.at,
      };
    }
    if (row) return { kind: "row", id: row.id, blockId: row.block, structure: row.structure, at: row.at };
  }
  if (location.blockId && blockIds.includes(location.blockId)) return { kind: "block", id: location.blockId };
  return null;
}

export function locationForSelection(selection: Selection | null, pinnedRow: string | null): { blockId: string | null; rowId: string | null } {
  if (!selection) return { blockId: null, rowId: null };
  if (selection.kind === "block") return { blockId: selection.id, rowId: canonicalizeRowId(pinnedRow) };
  if (selection.kind === "gap") return { blockId: selection.blockId || null, rowId: selection.rowId };
  if (selection.kind === "row") return { blockId: selection.blockId || null, rowId: selection.id };
  return { blockId: selection.blockId, rowId: null };
}

export function highlightedBlock(selection: Selection | null): string | null {
  if (!selection) return null;
  if (selection.kind === "block") return selection.id;
  return selection.blockId;
}

export function cameraTargetFor(selection: Selection | null, blockBbox: BBox | null, overview: BBox): CameraTarget {
  if ((selection?.kind === "gap" || selection?.kind === "waste") && selection.at) return { kind: "point", at: selection.at };
  if (selection?.kind === "row" && selection.at) return { kind: "point", at: selection.at };
  if ((selection?.kind === "block" || selection?.kind === "row") && blockBbox) return { kind: "bounds", bbox: blockBbox };
  return { kind: "bounds", bbox: overview };
}

export function walkHref(blockId: string | null, rowId: string | null): string {
  const params = new URLSearchParams();
  if (blockId) params.set("block", blockId);
  else if (!rowId) params.set("walk", "farmer");
  if (rowId) params.set("row", rowId);
  const query = params.toString();
  return query ? `/walks?${query}` : "/walks";
}

export function formatFlownShort(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return "Not measured";
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return "Not measured";
  return `${Number(match[3])} ${month}`;
}

export function flownLabel(iso: string): string {
  const short = formatFlownShort(iso);
  return short === "Not measured" ? "Flight date not measured" : `Flown ${short}`;
}

export function formatRowLength(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "Not measured";
  return `${km.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
}

export function formatGapMeters(gapM: number): string {
  if (!Number.isFinite(gapM) || gapM < 0) return "Not measured";
  const rounded = Math.round(gapM * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} m`;
}

export function rowNumberFromId(rowId: string): number | null {
  const match = /-R0*(\d+)$/i.exec(rowId);
  if (!match) return null;
  const row = Number(match[1]);
  return row > 0 ? row : null;
}

export function gapHoverLabel(blockId: string, rowNumber: number, gapM: number): string {
  return `${blockId} row ${rowNumber}, ${formatGapMeters(gapM)} gap`;
}

export function rowHoverLabel(rowId: string, structure: RowStructure): string {
  if (structure === "regular" || structure === "disrupted" || structure === "unassessable") return `${rowId}, ${structure}`;
  return `${rowId}, not measured`;
}

export function structureLabel(structure: RowStructure): string {
  if (structure === "regular") return "Regular structure";
  if (structure === "disrupted") return "Disrupted structure";
  if (structure === "unassessable") return "Unassessable structure";
  return "Not measured";
}

export function structureBar(percent: number | null): { regular: number; disrupted: number; caption: string } {
  if (percent == null || !Number.isFinite(percent)) return { regular: 0, disrupted: 0, caption: "Not measured" };
  const disrupted = Math.min(100, Math.max(0, percent));
  const rounded = Math.round(disrupted * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return { regular: 100 - disrupted, disrupted, caption: `${text}% of assessed pieces disrupted` };
}

export function wasteSummary(count: number): { label: string; action: string | null } {
  if (!Number.isFinite(count) || count < 0) return { label: "Not measured", action: null };
  const rounded = Math.round(count);
  if (rounded === 0) return { label: "No waste items", action: null };
  const noun = rounded === 1 ? "waste item" : "waste items";
  return { label: `${rounded.toLocaleString("en-US")} ${noun}`, action: "Collect" };
}

export function formatBearing(degrees: number): string {
  if (!Number.isFinite(degrees)) return "north";
  const rounded = Math.round(degrees);
  if (rounded === 0) return "north";
  const abs = Math.abs(rounded);
  return rounded < 0 ? `${abs}° west of north` : `${abs}° east of north`;
}

export function viewPadding(width: number): { top: number; right: number; bottom: number; left: number } {
  if (width <= 1024) return { top: 88, right: 28, bottom: 168, left: 28 };
  return { top: 100, right: 400, bottom: 96, left: 340 };
}

export function chipPosition(x: number, y: number, width: number, height: number): { left: number; top: number } {
  const chipWidth = 220;
  const left = Math.min(Math.max(8, x + 14), Math.max(8, width - chipWidth - 8));
  const top = Math.min(Math.max(8, y - 44), Math.max(8, height - 40));
  return { left, top };
}

export function haversineMeters(a: LonLat, b: LonLat): number {
  const radius = 6371000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Largest 1-2-5 step that fits in `spanMeters`. */
export function niceScaleMeters(spanMeters: number): number | null {
  if (!Number.isFinite(spanMeters) || spanMeters <= 0) return null;
  let choice: number = SCALE_STEPS[0];
  for (const step of SCALE_STEPS) {
    if (step <= spanMeters) choice = step;
  }
  return choice;
}

export function formatScale(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    const text = Number.isInteger(km) ? String(km) : km.toFixed(1);
    return `Scale ${text} km`;
  }
  return `Scale ${meters} m`;
}

function asLonLat(value: unknown): LonLat | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
}

function asPoints(value: unknown): LonLat[] {
  if (!Array.isArray(value)) return [];
  const points: LonLat[] = [];
  for (const item of value) {
    const point = asLonLat(item);
    if (point) points.push(point);
  }
  return points;
}

export function centroid(points: readonly LonLat[]): LonLat | null {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const ring = points.length > 1 && first && last && first[0] === last[0] && first[1] === last[1] ? points.slice(0, -1) : points;
  if (ring.length === 0 || !first) return null;
  let lon = 0;
  let lat = 0;
  for (const point of ring) {
    lon += point[0];
    lat += point[1];
  }
  return [lon / ring.length, lat / ring.length];
}

function featuresOf(value: unknown): Array<{ properties: Record<string, unknown>; geometry: unknown }> {
  if (!value || typeof value !== "object") return [];
  const features = (value as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const parsed: Array<{ properties: Record<string, unknown>; geometry: unknown }> = [];
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const properties = (feature as { properties?: unknown }).properties;
    parsed.push({
      properties: properties && typeof properties === "object" ? (properties as Record<string, unknown>) : {},
      geometry: (feature as { geometry?: unknown }).geometry,
    });
  }
  return parsed;
}

function stringProp(properties: Record<string, unknown>, key: string): string | null {
  const value = properties[key];
  return typeof value === "string" && value ? value : null;
}

function linePoints(geometry: unknown): LonLat[] {
  if (!geometry || typeof geometry !== "object") return [];
  const typed = geometry as { type?: string; coordinates?: unknown };
  if (typed.type === "LineString") return asPoints(typed.coordinates);
  if (typed.type === "MultiLineString" && Array.isArray(typed.coordinates)) {
    return typed.coordinates.flatMap((line) => asPoints(line));
  }
  return [];
}

function pointOf(geometry: unknown): LonLat | null {
  if (!geometry || typeof geometry !== "object") return null;
  const typed = geometry as { type?: string; coordinates?: unknown };
  if (typed.type !== "Point") return null;
  return asLonLat(typed.coordinates);
}

function outerRing(geometry: unknown): LonLat[] {
  if (!geometry || typeof geometry !== "object") return [];
  const typed = geometry as { type?: string; coordinates?: unknown };
  if (typed.type === "Point") {
    const point = asLonLat(typed.coordinates);
    return point ? [point] : [];
  }
  if (typed.type === "Polygon" && Array.isArray(typed.coordinates)) return asPoints(typed.coordinates[0]);
  if (typed.type === "MultiPolygon" && Array.isArray(typed.coordinates)) {
    const polygon = typed.coordinates[0];
    return Array.isArray(polygon) ? asPoints(polygon[0]) : [];
  }
  return [];
}

export function buildMapCatalog(input: {
  summary: Pick<Summary, "farm" | "flown_on" | "center" | "bbox" | "counts">;
  blocks: Block[];
  rows: VineyardRow[];
  rowFeatures: unknown;
  gapFeatures: unknown;
  wasteFeatures: unknown;
}): MapCatalog {
  const anchors = new Map<string, LonLat[]>();
  for (const feature of featuresOf(input.rowFeatures)) {
    const id = stringProp(feature.properties, "id");
    const anchor = centroid(linePoints(feature.geometry));
    if (!id || !anchor) continue;
    const bucket = anchors.get(id) ?? [];
    bucket.push(anchor);
    anchors.set(id, bucket);
  }

  const gaps = new Map<string, CatalogGap>();
  for (const feature of featuresOf(input.gapFeatures)) {
    const rowId = stringProp(feature.properties, "row_id");
    const id = stringProp(feature.properties, "id");
    const at = pointOf(feature.geometry);
    const gapM = Number(feature.properties.gap_m);
    if (!rowId || !id || !at || !Number.isFinite(gapM)) continue;
    const previous = gaps.get(rowId);
    if (!previous || gapM > previous.gapM) gaps.set(rowId, { id, gapM, at });
  }

  const waste: CatalogWaste[] = [];
  for (const feature of featuresOf(input.wasteFeatures)) {
    const id = stringProp(feature.properties, "id");
    const at = centroid(outerRing(feature.geometry));
    if (!id || !at) continue;
    const block = stringProp(feature.properties, "block");
    waste.push({ id, block, at });
  }

  return {
    farm: input.summary.farm,
    flownOn: input.summary.flown_on,
    center: input.summary.center,
    bbox: input.summary.bbox,
    counts: {
      plants: input.summary.counts.plants,
      rowPieces: input.summary.counts.row_pieces,
      interrows: input.summary.counts.interrows,
      gaps: input.summary.counts.gaps,
      waste: input.summary.counts.waste,
    },
    blocks: input.blocks,
    rows: input.rows.map((row) => {
      const pieces = anchors.get(row.id);
      return {
        id: row.id,
        block: row.block ?? "",
        row: row.row,
        structure: row.structure,
        at: pieces ? centroid(pieces) : null,
        gap: gaps.get(row.id) ?? null,
      };
    }),
    waste,
  };
}
