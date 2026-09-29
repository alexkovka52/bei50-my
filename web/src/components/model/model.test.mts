import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  HELD_OUT_LINE,
  MODEL_LEDE,
  TRAINING_LINE,
  datasetStats,
  flyAndTileDetail,
  formatMetricValue,
  heldOutLabel,
  pipelineSteps,
  splitParts,
} from "./model.ts";

test("pipeline is the six board steps in order", () => {
  assert.deepEqual(
    pipelineSteps("311 tiles at 2.5 cm per pixel, 82 ha").map((step) => step.title),
    ["Fly and tile", "Find every plant", "Trace the rows", "Read the ground", "Spot waste", "Plan the walk"],
  );
  const steps = pipelineSteps("311 tiles at 2.5 cm per pixel, 82 ha");
  assert.equal(steps[0]?.detail, "311 tiles at 2.5 cm per pixel, 82 ha");
  assert.equal(steps[1]?.detail, "One outline per vine canopy");
  assert.equal(steps[2]?.detail, "Row lines, joined across tiles");
  assert.equal(steps[3]?.detail, "Bare soil, grass or a mix");
  assert.equal(steps[4]?.detail, "Litter, not vine tubes or stakes");
  assert.equal(steps[5]?.detail, "A closed loop on legal paths");
  assert.equal(MODEL_LEDE, "Five models turn one drone flight into plants, rows, ground cover, waste and a walk.");
  assert.equal(
    HELD_OUT_LINE,
    "Held-out tiles are whole neighbourhoods of the vineyard, so a model cannot pass by memorising the rows next door.",
  );
  assert.equal(
    TRAINING_LINE,
    "Rows drawn as one long outline are cut into plant-sized pieces, and tiles with half-labelled plants are left out of plant training.",
  );
});

test("flyAndTileDetail uses the published flight and omits missing parts", () => {
  assert.equal(flyAndTileDetail({ tiles: 311, gsdM: 0.025, areaHa: 82 }), "311 tiles at 2.5 cm per pixel, 82 ha");
  assert.equal(flyAndTileDetail({ tiles: 311, gsdM: null, areaHa: null }), "311 tiles");
  assert.equal(flyAndTileDetail({ tiles: null, gsdM: null, areaHa: null }), "Not measured");
  assert.equal(flyAndTileDetail({ tiles: 311, gsdM: 0, areaHa: 21.78 }), "311 tiles, 21.78 ha");
});

test("formatMetricValue renders null scores as Pending or Not measured", () => {
  assert.equal(formatMetricValue("0.31", "before"), "0.31");
  assert.equal(formatMetricValue("2 of 7", "before"), "2 of 7");
  assert.equal(formatMetricValue(null, "before"), "Not measured");
  assert.equal(formatMetricValue("  ", "before"), "Not measured");
  assert.equal(formatMetricValue(null, "now"), "Pending");
  assert.equal(formatMetricValue("0.84", "now"), "0.84");
});

test("dataset card counts and the train, tune and score split", () => {
  assert.deepEqual(
    datasetStats({ tiles: 311, plants: 13308, rows: 2030, interrows: 1641, waste: 83, split: { train: 223, val: 43, test: 45 } }),
    [
      { value: "13,308", label: "plant outlines" },
      { value: "2,030", label: "row lines" },
      { value: "1,641", label: "inter-row areas" },
      { value: "83", label: "waste items" },
    ],
  );
  assert.deepEqual(splitParts({ train: 223, val: 43, test: 45 }), [
    { key: "train", label: "Learn", value: 223 },
    { key: "val", label: "Tune", value: 43 },
    { key: "test", label: "Score", value: 45 },
  ]);
  assert.equal(heldOutLabel(45), "45 held-out tiles");
  assert.equal(heldOutLabel(Number.NaN), "Not measured");
});
