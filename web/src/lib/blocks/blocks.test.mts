import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { Block, CoverCounts, VineyardRow } from "../data/types.ts";
import {
  blocksHeadingCount,
  blocksToCsv,
  coverParts,
  blocksWithRowDisruption,
  disruptedRowShare,
  filterBlocks,
  findBlock,
  formatDisrupted,
  formatMetres,
  formatRowKm,
  nextSort,
  rowsForBlock,
  selectedBlockId,
  sortBlocks,
  structureLabel,
} from "./blocks.ts";

const emptyCover = (): CoverCounts => ({
  bare_soil: 0,
  vegetation: 0,
  mixed: 0,
  unassessable: 0,
  unset: 0,
});

function block(over: Partial<Block> & Pick<Block, "id">): Block {
  return {
    rows: 10,
    row_km: 1,
    plants: 100,
    gaps: 1,
    waste: 0,
    interrow_ha: 0.2,
    canopy_m2: 10,
    disrupted_pct: 10,
    cover: emptyCover(),
    bbox: [0, 0, 1, 1],
    centroid: [0.5, 0.5],
    largest_gaps: [],
    ...over,
  };
}

const sample = [
  block({ id: "V02", rows: 105, row_km: 4.26, plants: 1889, gaps: 113, waste: 3, interrow_ha: 1.05, disrupted_pct: 47 }),
  block({ id: "V10", rows: 48, row_km: 1.1, plants: 430, gaps: 35, waste: 0, interrow_ha: 0.21, disrupted_pct: 26 }),
  block({ id: "V01", rows: 138, row_km: 4.71, plants: 2239, gaps: 100, waste: 0, interrow_ha: 1.15, disrupted_pct: 36 }),
  block({ id: "V07", rows: 37, row_km: 1.74, plants: 632, gaps: 33, waste: 0, interrow_ha: 0.31, disrupted_pct: null }),
];

test("sortBlocks orders longest rows first without mutating the input", () => {
  const original = sample.map((item) => item.id);
  const sorted = sortBlocks(sample, "row_km", "desc");
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["V01", "V02", "V07", "V10"],
  );
  assert.deepEqual(
    sample.map((item) => item.id),
    original,
  );
});

test("sortBlocks flips numeric columns and keeps null disruption last", () => {
  assert.deepEqual(
    sortBlocks(sample, "row_km", "asc").map((item) => item.id),
    ["V10", "V07", "V02", "V01"],
  );
  assert.deepEqual(
    sortBlocks(sample, "disrupted_pct", "desc").map((item) => item.id),
    ["V02", "V01", "V10", "V07"],
  );
  assert.deepEqual(
    sortBlocks(sample, "disrupted_pct", "asc").map((item) => item.id),
    ["V10", "V01", "V02", "V07"],
  );
});

test("sortBlocks breaks ties by block id and sorts ids numerically", () => {
  const tied = [
    block({ id: "V10", gaps: 4, row_km: 1 }),
    block({ id: "V2", gaps: 4, row_km: 1 }),
    block({ id: "V03", gaps: 9, row_km: 2 }),
  ];
  assert.deepEqual(
    sortBlocks(tied, "gaps", "desc").map((item) => item.id),
    ["V03", "V2", "V10"],
  );
  assert.deepEqual(
    sortBlocks(tied, "id", "asc").map((item) => item.id),
    ["V2", "V03", "V10"],
  );
});

test("nextSort toggles the active column and starts numbers high to low", () => {
  assert.deepEqual(nextSort({ key: "row_km", direction: "desc" }, "row_km"), { key: "row_km", direction: "asc" });
  assert.deepEqual(nextSort({ key: "row_km", direction: "asc" }, "row_km"), { key: "row_km", direction: "desc" });
  assert.deepEqual(nextSort({ key: "row_km", direction: "desc" }, "gaps"), { key: "gaps", direction: "desc" });
  assert.deepEqual(nextSort({ key: "gaps", direction: "desc" }, "id"), { key: "id", direction: "asc" });
});

test("blocksHeadingCount describes the default ranking", () => {
  assert.equal(blocksHeadingCount(30, { key: "row_km", direction: "desc" }), "30 blocks, longest rows first");
  assert.equal(blocksHeadingCount(1, { key: "row_km", direction: "desc" }), "1 block, longest rows first");
  assert.equal(blocksHeadingCount(30, { key: "gaps", direction: "asc" }), "30 blocks, fewest gaps first");
  assert.equal(blocksHeadingCount(0, { key: "id", direction: "asc" }), "0 blocks, block id ascending");
});

test("filterBlocks matches block ids and leaves the source untouched", () => {
  assert.deepEqual(
    filterBlocks(sample, " v0 ").map((item) => item.id),
    ["V02", "V01", "V07"],
  );
  assert.deepEqual(
    filterBlocks(sample, "V10").map((item) => item.id),
    ["V10"],
  );
  assert.equal(filterBlocks(sample, "   ").length, sample.length);
  assert.equal(filterBlocks(sample, "missing").length, 0);
  assert.equal(sample.length, 4);
});

test("blocksToCsv exports every block with a header and empty cells for nulls", () => {
  const csv = blocksToCsv([sample[2]!, sample[3]!, block({ id: 'V"1, east', rows: 2, row_km: 1.2, plants: 3, gaps: 4, waste: 5, interrow_ha: 0.5, disrupted_pct: 8 })]);
  assert.equal(
    csv,
    [
      "Block,Rows,Row length (km),Plants,Disrupted rows (%),Gaps,Waste,Inter-row (ha)",
      "V01,138,4.71,2239,36,100,0,1.15",
      "V07,37,1.74,632,,33,0,0.31",
      '"V""1, east",2,1.2,3,8,4,5,0.5',
      "",
    ].join("\n"),
  );
});

test("findBlock matches ids without falling back to another block", () => {
  assert.equal(findBlock(sample, "v01")?.id, "V01");
  assert.equal(findBlock(sample, "  "), null);
  assert.equal(findBlock(sample, "missing"), null);
});

test("selectedBlockId keeps a known id and otherwise uses the first block", () => {
  assert.equal(selectedBlockId(sample, "v07"), "V07");
  assert.equal(selectedBlockId(sample, "nope"), "V02");
  assert.equal(selectedBlockId(sample, null), "V02");
  assert.equal(selectedBlockId([], "V01"), null);
});

test("coverParts drops empty classes and names unset ground", () => {
  assert.deepEqual(
    coverParts({ bare_soil: 65, vegetation: 0, mixed: 8, unassessable: 0, unset: 54 }),
    [
      { key: "bare_soil", label: "Bare", value: 65 },
      { key: "mixed", label: "Mixed", value: 8 },
      { key: "unset", label: "Not assessed", value: 54 },
    ],
  );
  assert.deepEqual(coverParts(emptyCover()), []);
});

test("formatters render row length, gaps and disruption", () => {
  assert.equal(formatRowKm(4.71), "4.71 km");
  assert.equal(formatRowKm(1.1), "1.10 km");
  assert.equal(formatRowKm(-1), "Not measured");
  assert.equal(formatMetres(37.9), "37.9 m");
  assert.equal(formatMetres(36), "36 m");
  assert.equal(formatMetres(Number.NaN), "Not measured");
  assert.equal(formatDisrupted(51), "51%");
  assert.equal(formatDisrupted(null), "Not measured");
  assert.equal(structureLabel("disrupted"), "Disrupted");
  assert.equal(structureLabel(null), "Not measured");
  assert.equal(structureLabel("regular"), "Regular");
  assert.equal(structureLabel("unassessable"), "Unassessable");
});

test("disruptedRowShare uses aggregated rows and ignores unset structure", () => {
  const rows: VineyardRow[] = [
    { id: "a", block: "V01", row: 1, length_m: 10, structure: "disrupted", pieces: 4 },
    { id: "b", block: "V01", row: 2, length_m: 10, structure: "regular", pieces: 1 },
    { id: "c", block: "V01", row: 3, length_m: 10, structure: null, pieces: 2 },
    { id: "d", block: "V01", row: 4, length_m: 10, structure: "unassessable", pieces: 1 },
    { id: "e", block: "V02", row: 1, length_m: 10, structure: "disrupted", pieces: 1 },
  ];
  assert.equal(disruptedRowShare(rows, "V01"), 50);
  assert.equal(disruptedRowShare(rows, "V02"), 100);
  assert.equal(disruptedRowShare(rows, "V03"), null);
  assert.equal(disruptedRowShare(rows), 67);
  assert.equal(blocksWithRowDisruption([block({ id: "V01", disrupted_pct: 36 }), block({ id: "V09", disrupted_pct: 4 })], rows)[0]?.disrupted_pct, 50);
  assert.equal(blocksWithRowDisruption([block({ id: "V09", disrupted_pct: 4 })], rows)[0]?.disrupted_pct, null);
});

test("rowsForBlock returns one block in row order", () => {
  const rows: VineyardRow[] = [
    { id: "V03-R010", block: "V03", row: 10, length_m: 20, structure: "disrupted", pieces: 1 },
    { id: "V01-R001", block: "V01", row: 1, length_m: 30, structure: "regular", pieces: 1 },
    { id: "V03-R002", block: "V03", row: 2, length_m: 12.5, structure: null, pieces: 2 },
    { id: "loose", block: "OTHER", row: 1, length_m: 4, structure: "regular", pieces: 1 },
  ];
  assert.deepEqual(
    rowsForBlock(rows, "V03").map((row) => row.id),
    ["V03-R002", "V03-R010"],
  );
  assert.equal(rows.length, 4);
  assert.deepEqual(rowsForBlock(rows, "missing"), []);
});

test("published blocks sort longest first and export all thirty", () => {
  const file = JSON.parse(readFileSync(fileURLToPath(new URL("../../../public/data/blocks.json", import.meta.url)), "utf8")) as {
    blocks: Block[];
  };
  const publishedRows = JSON.parse(readFileSync(fileURLToPath(new URL("../../../public/data/rows.json", import.meta.url)), "utf8")) as {
    rows: VineyardRow[];
  };
  assert.equal(disruptedRowShare(publishedRows.rows), 40);
  assert.equal(disruptedRowShare(publishedRows.rows, "V01"), 47);
  const ranked = blocksWithRowDisruption(file.blocks, publishedRows.rows);
  assert.equal(file.blocks.length, 30);
  const sorted = sortBlocks(ranked, "row_km", "desc");
  assert.equal(sorted[0]?.id, "V01");
  assert.ok((sorted[0]?.row_km ?? 0) >= (sorted[1]?.row_km ?? 0));
  const lines = blocksToCsv(sorted).trimEnd().split("\n");
  assert.equal(lines.length, 31);
  assert.match(lines[1] ?? "", /^V01,/);
  assert.equal(filterBlocks(file.blocks, "v03").length, 1);
});
