import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Block } from "../data/types.ts";
import {
  DEFAULT_LAYERS,
  buildMapCatalog,
  cameraTargetFor,
  canonicalizeBlockId,
  canonicalizeRowId,
  chipPosition,
  decodeLayers,
  encodeLayers,
  formatBearing,
  formatFlownShort,
  formatGapMeters,
  formatRowLength,
  formatScale,
  gapHoverLabel,
  haversineMeters,
  locationForSelection,
  mapSearchString,
  niceScaleMeters,
  parseMapQuery,
  parseMapSearch,
  resolveQuery,
  rowHoverLabel,
  selectionForLocation,
  structureBar,
  viewPadding,
  walkHref,
  wasteSummary,
} from "./map-state.ts";

const block = {
  id: "V02",
  rows: 105,
  row_km: 4.26,
  plants: 1889,
  gaps: 113,
  waste: 3,
  interrow_ha: 1.05,
  canopy_m2: 1,
  disrupted_pct: 47,
  cover: { bare_soil: 1, vegetation: 0, mixed: 0, unassessable: 0, unset: 0 },
  bbox: [28.7, 47.12, 28.71, 47.13] as [number, number, number, number],
  centroid: [28.705, 47.125] as [number, number],
  largest_gaps: [],
} satisfies Block;

test("parseMapQuery accepts blocks and both row phrasings", () => {
  assert.deepEqual(parseMapQuery("V04"), { kind: "block", id: "V04" });
  assert.deepEqual(parseMapQuery(" v4 "), { kind: "block", id: "V04" });
  assert.deepEqual(parseMapQuery("block V02"), { kind: "block", id: "V02" });
  assert.deepEqual(parseMapQuery("V04-R032"), { kind: "row", id: "V04-R032", blockId: "V04", row: 32 });
  assert.deepEqual(parseMapQuery("v4-r32"), { kind: "row", id: "V04-R032", blockId: "V04", row: 32 });
  assert.deepEqual(parseMapQuery("V04  row   32"), { kind: "row", id: "V04-R032", blockId: "V04", row: 32 });
  assert.equal(parseMapQuery("row 32"), null);
  assert.equal(parseMapQuery("V04 please"), null);
  assert.equal(parseMapQuery("V00"), null);
  assert.equal(parseMapQuery(""), null);
});

test("resolveQuery only returns ids that exist", () => {
  assert.equal(resolveQuery("V09", ["V02"], ["V04-R032"])?.kind, undefined);
  assert.equal(resolveQuery("V04-R032", ["V04"], ["V04-R032"])?.id, "V04-R032");
  assert.equal(resolveQuery("V04", ["V04"], [])?.id, "V04");
});

test("layer param round-trips and empty means all off", () => {
  assert.equal(encodeLayers(DEFAULT_LAYERS), "plants,rows,gaps,waste");
  assert.deepEqual(decodeLayers("plants,rows,gaps,waste"), DEFAULT_LAYERS);
  assert.deepEqual(decodeLayers(""), decodeLayers("nope"));
  assert.equal(decodeLayers("").paths, false);
  assert.equal(decodeLayers("paths,waste").paths, true);
  assert.equal(decodeLayers("paths,waste").plants, false);
});

test("map search keeps block, row, and non-default layers", () => {
  assert.equal(mapSearchString({ layers: DEFAULT_LAYERS, blockId: "V02", rowId: "V02-R076" }), "block=V02&row=V02-R076");
  const allOff = decodeLayers("");
  assert.equal(mapSearchString({ layers: allOff, blockId: "V02", rowId: null }), "layers=&block=V02");
  const parsed = parseMapSearch("?layers=&block=v2&row=V02%20row%2076");
  assert.equal(parsed.blockId, "V02");
  assert.equal(parsed.rowId, "V02-R076");
  assert.equal(parsed.layers?.plants, false);
  assert.equal(canonicalizeBlockId("v2"), "V02");
  assert.equal(canonicalizeRowId("V02-R076"), "V02-R076");
  assert.deepEqual(parseMapSearch("block=V01&row=V02-R076"), {
    layers: null,
    blockId: "V02",
    rowId: "V02-R076",
  });
});

test("selection follows the row when the URL names one", () => {
  const rows = [
    {
      id: "V02-R076",
      block: "V02",
      row: 76,
      structure: "disrupted" as const,
      at: [28.7, 47.12] as [number, number],
      gap: { id: "GAP-V02-R076-03", gapM: 12.5, at: [28.71, 47.121] as [number, number] },
    },
  ];
  const selection = selectionForLocation({ layers: null, blockId: "V02", rowId: "V02-R076" }, rows, ["V02"]);
  assert.equal(selection?.kind, "gap");
  if (selection?.kind === "gap") assert.equal(selection.gapM, 12.5);
  assert.deepEqual(locationForSelection({ kind: "block", id: "V02" }, "V02-R076"), {
    blockId: "V02",
    rowId: "V02-R076",
  });
  assert.deepEqual(cameraTargetFor(selection, block.bbox, [0, 0, 1, 1]), {
    kind: "point",
    at: [28.71, 47.121],
  });
  assert.equal(cameraTargetFor(null, null, [0, 0, 1, 1]).kind, "bounds");
});

test("labels use measured gap text and a short flight date", () => {
  assert.equal(gapHoverLabel("V02", 76, 12.5), "V02 row 76, 12.5 m gap");
  assert.equal(formatGapMeters(64), "64 m");
  assert.equal(rowHoverLabel("V04-R032", "disrupted"), "V04-R032, disrupted");
  assert.equal(rowHoverLabel("V04-R032", null), "V04-R032, not measured");
  assert.equal(formatFlownShort("2026-09-20"), "20 Sep");
  assert.equal(formatFlownShort("nope"), "Not measured");
  assert.equal(formatRowLength(4.26), "4.26 km");
  assert.equal(formatRowLength(-1), "Not measured");
  assert.deepEqual(structureBar(47), { regular: 53, disrupted: 47, caption: "47% of assessed rows disrupted" });
  assert.equal(structureBar(null).caption, "Not measured");
  assert.deepEqual(wasteSummary(0), { label: "No waste items", action: null });
  assert.deepEqual(wasteSummary(3), { label: "3 waste items", action: "Collect" });
  assert.equal(wasteSummary(13308).label, "13,308 waste items");
  assert.equal(formatBearing(-10), "10° west of north");
  assert.equal(formatBearing(0), "north");
});

test("walk links stay on the walks contract", () => {
  assert.equal(walkHref("V02", null), "/walks?block=V02");
  assert.equal(walkHref("V02", "V02-R076"), "/walks?block=V02&row=V02-R076");
  assert.equal(walkHref(null, null), "/walks?walk=farmer");
});

test("scale, padding, and chip position stay on screen", () => {
  const meters = haversineMeters([28.7, 47.12], [28.7, 47.121]);
  assert.ok(meters > 100 && meters < 120, `expected about 111 m, got ${meters}`);
  assert.equal(niceScaleMeters(25), 20);
  assert.equal(formatScale(20), "Scale 20 m");
  assert.equal(formatScale(2000), "Scale 2 km");
  assert.equal(niceScaleMeters(0), null);
  assert.deepEqual(viewPadding(1440).left, 340);
  assert.deepEqual(viewPadding(390).bottom, 168);
  const chip = chipPosition(2, 2, 400, 300);
  assert.ok(chip.left >= 8 && chip.top >= 8);
});

test("catalog keeps the largest gap and a row anchor", () => {
  const catalog = buildMapCatalog({
    summary: {
      farm: "Sireț3 vineyard",
      flown_on: "2026-09-20",
      center: [28.7, 47.12],
      bbox: [28.6, 47.1, 28.8, 47.2],
      counts: { blocks: 1, rows: 1, row_pieces: 2, plants: 4, interrows: 1, waste: 1, gaps: 2 },
    },
    blocks: [block],
    rows: [{ id: "V02-R076", block: "V02", row: 76, length_m: 10, structure: "disrupted", pieces: 2 }],
    rowFeatures: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { id: "V02-R076" }, geometry: { type: "LineString", coordinates: [[0, 0], [2, 0]] } },
        { type: "Feature", properties: { id: "V02-R076" }, geometry: { type: "LineString", coordinates: [[0, 2], [2, 2]] } },
      ],
    },
    gapFeatures: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { id: "GAP-1", row_id: "V02-R076", gap_m: 5 }, geometry: { type: "Point", coordinates: [1, 1] } },
        { type: "Feature", properties: { id: "GAP-2", row_id: "V02-R076", gap_m: 12.5 }, geometry: { type: "Point", coordinates: [3, 4] } },
      ],
    },
    wasteFeatures: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { id: "WASTE-V02-001", block: "V02" },
          geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]] },
        },
      ],
    },
  });
  assert.equal(catalog.counts.rowPieces, 2);
  assert.deepEqual(catalog.rows[0]?.at, [1, 1]);
  assert.equal(catalog.rows[0]?.gap?.id, "GAP-2");
  assert.deepEqual(catalog.waste[0]?.at, [1, 1]);
  assert.equal(catalog.farm, "Sireț3 vineyard");
});
