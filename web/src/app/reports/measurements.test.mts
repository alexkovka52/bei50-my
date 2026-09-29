import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Summary } from "../../lib/data/types.ts";
import { measurementTables } from "./measurements.ts";

function summary(over: Partial<Summary> = {}): Summary {
  return {
    version: 1,
    source: "marcaj-labels",
    generated_at: "2026-09-29T16:08:48Z",
    flown_on: "2026-09-20",
    farm: "Sireț3 vineyard",
    area_ha: 82,
    tiles: 311,
    gsd_m: 0.025,
    center: [28.71, 47.12],
    bbox: [28.7, 47.11, 28.72, 47.13],
    start: [28.7, 47.12],
    counts: {
      blocks: 30,
      rows: 1650,
      row_pieces: 2030,
      plants: 13308,
      interrows: 1641,
      waste: 83,
      gaps: 1091,
    },
    row_km: 39.11,
    canopy_ha: 1,
    interrow_ha: 21.78,
    cover: { bare_soil: 908, vegetation: 67, mixed: 119, unassessable: 2, unset: 545 },
    structure: { regular: 790, disrupted: 477, unassessable: 0, unset: 763 },
    walks: { inspector: { length_m: 7991.683, stops: 0 }, farmer: { length_m: 4293.173, stops: 0 } },
    ...over,
  };
}

test("measurementTables lists survey, counts, cover and structure", () => {
  const tables = measurementTables(summary());
  assert.deepEqual(tables.survey, [
    { label: "Area", value: "82 ha" },
    { label: "Row length", value: "39.11 km" },
    { label: "Canopy", value: "1 ha" },
    { label: "Inter-row", value: "21.78 ha" },
  ]);
  assert.deepEqual(
    tables.counts.map((row) => row.label),
    ["Blocks", "Rows", "Row pieces", "Plants", "Inter-rows", "Gaps", "Waste"],
  );
  assert.equal(tables.counts.find((row) => row.label === "Plants")?.value, "13,308");
  assert.equal(tables.cover.find((row) => row.label === "Bare soil")?.value, "908");
  assert.equal(tables.cover.find((row) => row.label === "Not assessed")?.value, "545");
  assert.equal(tables.structure.find((row) => row.label === "Disrupted")?.value, "477");
  assert.equal(tables.structure.find((row) => row.label === "Unassessable")?.value, "0");
});

test("measurementTables renders a missing number as Not measured", () => {
  const tables = measurementTables(summary({ area_ha: Number.NaN, row_km: -1 }));
  assert.equal(tables.survey[0]?.value, "Not measured");
  assert.equal(tables.survey[1]?.value, "Not measured");
});
