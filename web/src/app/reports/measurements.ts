import type { Summary } from "../../lib/data/types";

const NOT_MEASURED = "Not measured";

const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const hectareFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const kilometreFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type MeasureRow = { label: string; value: string };

export type MeasurementTables = {
  survey: MeasureRow[];
  counts: MeasureRow[];
  cover: MeasureRow[];
  structure: MeasureRow[];
};

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return NOT_MEASURED;
  return integerFormat.format(Math.round(value));
}

function formatHa(hectares: number): string {
  if (!Number.isFinite(hectares) || hectares < 0) return NOT_MEASURED;
  return `${hectareFormat.format(hectares)} ha`;
}

function formatRowKm(rowKm: number): string {
  if (!Number.isFinite(rowKm) || rowKm < 0) return NOT_MEASURED;
  return `${kilometreFormat.format(rowKm)} km`;
}

export function measurementTables(summary: Summary): MeasurementTables {
  return {
    survey: [
      { label: "Area", value: formatHa(summary.area_ha) },
      { label: "Row length", value: formatRowKm(summary.row_km) },
      { label: "Canopy", value: formatHa(summary.canopy_ha) },
      { label: "Inter-row", value: formatHa(summary.interrow_ha) },
    ],
    counts: [
      { label: "Blocks", value: formatCount(summary.counts.blocks) },
      { label: "Rows", value: formatCount(summary.counts.rows) },
      { label: "Row pieces", value: formatCount(summary.counts.row_pieces) },
      { label: "Plants", value: formatCount(summary.counts.plants) },
      { label: "Inter-rows", value: formatCount(summary.counts.interrows) },
      { label: "Gaps", value: formatCount(summary.counts.gaps) },
      { label: "Waste", value: formatCount(summary.counts.waste) },
    ],
    cover: [
      { label: "Bare soil", value: formatCount(summary.cover.bare_soil) },
      { label: "Vegetation", value: formatCount(summary.cover.vegetation) },
      { label: "Mixed", value: formatCount(summary.cover.mixed) },
      { label: "Unassessable", value: formatCount(summary.cover.unassessable) },
      { label: "Not assessed", value: formatCount(summary.cover.unset) },
    ],
    structure: [
      { label: "Regular", value: formatCount(summary.structure.regular) },
      { label: "Disrupted", value: formatCount(summary.structure.disrupted) },
      { label: "Unassessable", value: formatCount(summary.structure.unassessable) },
      { label: "Not assessed", value: formatCount(summary.structure.unset) },
    ],
  };
}
