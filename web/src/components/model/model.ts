const NOT_MEASURED = "Not measured";

const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const hectareFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const centimetreFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export const MODEL_TITLE = "How Dementra reads your vineyard";
export const MODEL_LEDE = "Five models turn one drone flight into plants, rows, ground cover, waste and a walk.";
export const HELD_OUT_LINE =
  "Held-out tiles are whole neighbourhoods of the vineyard, so a model cannot pass by memorising the rows next door.";
export const TRAINING_LINE =
  "Rows drawn as one long outline are cut into plant-sized pieces, and tiles with half-labelled plants are left out of plant training.";

const LATER_STEPS = [
  { title: "Find every plant", detail: "One outline per vine canopy" },
  { title: "Trace the rows", detail: "Row lines, joined across tiles" },
  { title: "Read the ground", detail: "Bare soil, grass or a mix" },
  { title: "Spot waste", detail: "Litter, not vine tubes or stakes" },
  { title: "Plan the walk", detail: "A closed loop on legal paths" },
] as const;

export type PipelineStep = { title: string; detail: string };

export type FlightFigures = {
  tiles: number | null;
  gsdM: number | null;
  areaHa: number | null;
};

export type DatasetCounts = {
  tiles: number;
  plants: number;
  rows: number;
  interrows: number;
  waste: number;
  split: { train: number; val: number; test: number };
};

export type SplitPart = { key: "train" | "val" | "test"; label: string; value: number };

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return NOT_MEASURED;
  return integerFormat.format(Math.round(value));
}

function formatHa(hectares: number): string {
  return `${hectareFormat.format(hectares)} ha`;
}

export function flyAndTileDetail(input: FlightFigures): string {
  const parts: string[] = [];
  if (input.tiles !== null && Number.isFinite(input.tiles) && input.tiles >= 0) {
    let text = `${formatCount(input.tiles)} tiles`;
    if (input.gsdM !== null && Number.isFinite(input.gsdM) && input.gsdM > 0) {
      text += ` at ${centimetreFormat.format(input.gsdM * 100)} cm per pixel`;
    }
    parts.push(text);
  }
  if (input.areaHa !== null && Number.isFinite(input.areaHa) && input.areaHa >= 0) parts.push(formatHa(input.areaHa));
  return parts.length > 0 ? parts.join(", ") : NOT_MEASURED;
}

export function pipelineSteps(flyAndTile: string): PipelineStep[] {
  return [{ title: "Fly and tile", detail: flyAndTile }, ...LATER_STEPS];
}

export function formatMetricValue(value: string | null, column: "before" | "now"): string {
  if (value === null || value.trim() === "") return column === "now" ? "Pending" : NOT_MEASURED;
  return value;
}

export function datasetStats(dataset: DatasetCounts): { value: string; label: string }[] {
  return [
    { value: formatCount(dataset.plants), label: "plant outlines" },
    { value: formatCount(dataset.rows), label: "row lines" },
    { value: formatCount(dataset.interrows), label: "inter-row areas" },
    { value: formatCount(dataset.waste), label: "waste items" },
  ];
}

function splitValue(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function splitParts(split: DatasetCounts["split"]): SplitPart[] {
  return [
    { key: "train", label: "Learn", value: splitValue(split.train) },
    { key: "val", label: "Tune", value: splitValue(split.val) },
    { key: "test", label: "Score", value: splitValue(split.test) },
  ];
}

export function heldOutLabel(testTiles: number): string {
  if (!Number.isFinite(testTiles) || testTiles < 0) return NOT_MEASURED;
  return `${formatCount(testTiles)} held-out tiles`;
}
