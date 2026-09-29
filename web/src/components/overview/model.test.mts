import { strict as assert } from "node:assert";
import { register } from "node:module";
import { test } from "node:test";
import type { Block, Summary, Task, VineyardRow } from "../../lib/data/types.ts";

const globalScope = globalThis as { __dementraAlias?: boolean };
if (!globalScope.__dementraAlias) {
  globalScope.__dementraAlias = true;
  register(new URL("../../lib/weather/resolve-alias.mjs", import.meta.url));
}

const {
  bareSoilNote,
  bareSoilPercent,
  blockChip,
  blockWithMostGaps,
  coverSlices,
  disruptedRowCount,
  formatWalkKm,
  frameZoom,
  mowingCopy,
  numberStats,
  previewSubtitle,
  statusDetail,
  statusHeadline,
  taskCards,
  taskTitle,
} = await import("./model.ts");

function summary(overrides: Partial<Summary> = {}): Summary {
  return {
    version: 1,
    source: "marcaj-labels",
    generated_at: "2026-09-29T16:08:48Z",
    flown_on: "2026-09-20",
    farm: "Sireț3 vineyard",
    area_ha: 82,
    tiles: 311,
    gsd_m: 0.025,
    center: [28.7120576, 47.1215059],
    bbox: [28.7009382, 47.1135361, 28.723177, 47.1294757],
    start: [28.7073776, 47.1230335],
    counts: { blocks: 30, rows: 1650, row_pieces: 2030, plants: 13308, interrows: 1641, waste: 83, gaps: 1091 },
    row_km: 39.11,
    canopy_ha: 1,
    interrow_ha: 21.78,
    cover: { bare_soil: 908, vegetation: 67, mixed: 119, unassessable: 2, unset: 545 },
    structure: { regular: 790, disrupted: 477, unassessable: 0, unset: 763 },
    walks: { inspector: { length_m: 7991.683, stops: 0 }, farmer: { length_m: 4293.173, stops: 0 } },
    ...overrides,
  };
}

test("status copy uses the survey counts and the inspector walk", () => {
  const data = summary();
  assert.equal(statusHeadline(data), "1,091 planting gaps and 83 waste items are waiting across 30 blocks.");
  assert.equal(statusDetail(data), "The inspector walk covers 7.99 km, about 2 h.");
  assert.equal(statusDetail(data, { visited: 40, total: 83 }), "One inspector walk visits 40 of them: 7.99 km, about 2 h.");
  assert.equal(statusDetail(data, { visited: 83, total: 83 }), "One inspector walk visits all of them: 7.99 km, about 2 h.");
  assert.equal(formatWalkKm(7991.683), "7.99 km");
  assert.equal(formatWalkKm(-1), "Not measured");
});

test("status copy pluralises a single gap, item, block and stop", () => {
  const data = summary({
    counts: { blocks: 1, rows: 1, row_pieces: 1, plants: 1, interrows: 1, waste: 1, gaps: 1 },
    walks: { inspector: { length_m: 2000, stops: 1 }, farmer: { length_m: 0, stops: 0 } },
  });
  assert.equal(statusHeadline(data), "1 planting gap and 1 waste item are waiting across 1 block.");
  assert.equal(statusDetail(data), "The inspector walk covers 2.00 km, about 30 min, 1 stop.");
  assert.equal(
    statusDetail(data, { visited: 1, total: 4 }),
    "One inspector walk visits 1 of them: 2.00 km, about 30 min, 1 stop.",
  );
});

test("the number strip is rows, plants, inter-row ground and disrupted rows", () => {
  const classified: VineyardRow[] = [
    { id: "d1", block: "V01", row: 1, length_m: 1, structure: "disrupted", pieces: 9 },
    { id: "d2", block: "V01", row: 2, length_m: 1, structure: "disrupted", pieces: 9 },
    { id: "r1", block: "V01", row: 3, length_m: 1, structure: "regular", pieces: 1 },
    { id: "r2", block: "V01", row: 4, length_m: 1, structure: "regular", pieces: 1 },
    { id: "r3", block: "V01", row: 5, length_m: 1, structure: "regular", pieces: 1 },
    { id: "u1", block: "V01", row: 6, length_m: 1, structure: null, pieces: 4 },
    { id: "u2", block: "V01", row: 7, length_m: 1, structure: "unassessable", pieces: 1 },
  ];
  const stats = numberStats(summary(), classified);
  assert.deepEqual(
    stats.map((stat) => [stat.label, stat.value, stat.unit ?? "", stat.note]),
    [
      ["Rows", "39.1", "km", "2,030 row pieces"],
      ["Plants", "13,308", "", "1.0 ha of canopy"],
      ["Inter-row ground", "21.8", "ha", "55.3% bare soil"],
      ["Disrupted rows", "40", "%", "a gap of 5 m or more"],
    ],
  );
  const cover = summary().cover;
  const interrows = cover.bare_soil + cover.vegetation + cover.mixed + cover.unassessable + cover.unset;
  assert.equal(bareSoilPercent(cover), (cover.bare_soil / interrows) * 100);
  assert.equal(bareSoilNote({ bare_soil: 0, vegetation: 0, mixed: 0, unassessable: 2, unset: 4 }), "0% bare soil");
  assert.equal(bareSoilNote({ bare_soil: 0, vegetation: 0, mixed: 0, unassessable: 0, unset: 0 }), "Not measured");
  assert.equal(numberStats(summary(), null)[3]?.value, "Not measured");
});

test("inter-row cover keeps not assessed and unassessable apart", () => {
  const slices = coverSlices(summary().cover);
  assert.deepEqual(
    slices.map((slice) => [slice.label, slice.count]),
    [
      ["Bare soil", 908],
      ["Mixed", 119],
      ["Vegetation", 67],
      ["Unassessable", 2],
      ["Not assessed", 545],
    ],
  );
  assert.equal(mowingCopy(summary().cover), "Mostly tilled. 186 inter-rows carry grass worth mowing before harvest traffic.");
  assert.equal(
    mowingCopy({ bare_soil: 1, vegetation: 1, mixed: 0, unassessable: 0, unset: 0 }),
    "1 inter-row carries grass worth mowing before harvest traffic.",
  );
});

test("task cards keep priority order and the board's wording", () => {
  const tasks: Task[] = [
    { id: "b", kind: "waste", block: "V08", row_id: null, row: null, gap_m: null, at: [0, 0], priority: 3 },
    { id: "a", kind: "gap", block: "V04", row_id: "V04-R032", row: 32, gap_m: 64, at: [0, 0], priority: 1 },
    { id: "c", kind: "gap", block: "V04", row_id: "V04-R024", row: 24, gap_m: 43.3, at: [0, 0], priority: 2 },
    { id: "d", kind: "waste", block: null, row_id: null, row: null, gap_m: null, at: [0, 0], priority: 4 },
  ];
  const cards = taskCards(tasks, 3);
  assert.deepEqual(
    cards.map((card) => [card.priority, card.title, card.detail, card.tone]),
    [
      [1, "64 m gap, V04 row 32", "Check missing plants", "gap"],
      [2, "43.3 m gap, V04 row 24", "Check missing plants", "gap"],
      [3, "Waste item, V08", "Collect before spraying", "waste"],
    ],
  );
  assert.equal(taskTitle(tasks[3]!), "Waste item");
  assert.equal(taskTitle({ ...tasks[1]!, gap_m: null, block: null, row: null }), "Planting gap");
});

test("the preview frames the block with the most gaps", () => {
  const blocks = [
    { id: "V01", gaps: 100, waste: 9, rows: 10, row_km: 4.26 },
    { id: "V04", gaps: 133, waste: 0, rows: 116, row_km: 3.69 },
    { id: "V09", gaps: 133, waste: 4, rows: 20, row_km: 1 },
  ] as Block[];
  assert.equal(blockWithMostGaps(blocks)?.id, "V09");
  assert.equal(blockWithMostGaps([]) , null);
  const rows: VineyardRow[] = [
    { id: "V04-R001", block: "V04", row: 1, length_m: 10, structure: "disrupted", pieces: 1 },
    { id: "V04-R002", block: "V04", row: 2, length_m: 10, structure: "regular", pieces: 1 },
    { id: "V01-R001", block: "V01", row: 1, length_m: 10, structure: "disrupted", pieces: 2 },
  ];
  assert.equal(disruptedRowCount(rows, "V04"), 1);
  assert.deepEqual(blockChip(blocks[1]!, 41), {
    title: "Block V04",
    rowsKm: "116 rows, 3.7 km",
    disrupted: "41 disrupted",
    waste: "0 waste",
  });
  assert.equal(blockChip(blocks[1]!, null).disrupted, "Not measured");
  assert.equal(previewSubtitle(summary()), "82 ha, 311 tiles at 2.5 cm");
  const zoom = frameZoom([28.7009382, 47.126796, 28.7029087, 47.1280096]);
  assert.ok(zoom >= 14 && zoom <= 16.5, `zoom ${zoom}`);
  assert.equal(frameZoom([1, 1, 1, 2]), 15);
});
