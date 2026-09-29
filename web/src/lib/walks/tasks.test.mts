import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  doneStorageKey,
  filterTasks,
  kindCounts,
  nextTaskAhead,
  parseBlockParam,
  parseWalkParam,
  taskHeading,
  taskNote,
  walkHref,
  type FieldTask,
} from "./tasks.ts";

const tasks: FieldTask[] = [
  { id: "GAP-V04-R032-01", kind: "gap", block: "V04", row: 32, gap_m: 64, priority: 2 },
  { id: "GAP-V04-R024-01", kind: "gap", block: "V04", row: 24, gap_m: 43.3, priority: 1 },
  { id: "WASTE-V08-01", kind: "waste", block: "V08", row: null, gap_m: null, priority: 4 },
  { id: "WASTE-X-001", kind: "waste", block: null, row: null, gap_m: null, priority: 3 },
  { id: "GAP-V02-R001-01", kind: "gap", block: "V02", row: 1, gap_m: 12.4, priority: 5 },
];

test("filterTasks keeps the farmer on waste and sorts by priority", () => {
  const farmer = filterTasks(tasks, { walk: "farmer" });
  assert.deepEqual(farmer.map((task) => task.id), ["WASTE-X-001", "WASTE-V08-01"]);
  const block = filterTasks(tasks, { walk: "inspector", block: "V04" });
  assert.deepEqual(block.map((task) => task.id), ["GAP-V04-R024-01", "GAP-V04-R032-01"]);
  const gaps = filterTasks(tasks, { kind: "gap" });
  assert.deepEqual(
    gaps.map((task) => task.id),
    ["GAP-V04-R024-01", "GAP-V04-R032-01", "GAP-V02-R001-01"],
  );
  assert.deepEqual(kindCounts(filterTasks(tasks, { walk: "inspector" })), { all: 5, gap: 3, waste: 2 });
  assert.deepEqual(kindCounts(farmer), { all: 2, gap: 0, waste: 2 });
});

test("task headings match the field list", () => {
  assert.equal(taskHeading(tasks[0]), "64 m gap, V04 row 32");
  assert.equal(taskHeading(tasks[1]), "43 m gap, V04 row 24");
  assert.equal(taskHeading(tasks[2]), "Waste, V08");
  assert.equal(taskHeading(tasks[3]), "Waste");
  assert.equal(taskHeading({ kind: "gap", block: "V01", row: null, gap_m: null }), "Gap, V01");
  assert.equal(taskNote("gap", "list"), "Missing plants");
  assert.equal(taskNote("gap", "next"), "Count the missing plants");
  assert.equal(taskNote("waste", "next"), "Collect before spraying");
});

test("nextTaskAhead stays on the stop in reach, then wraps the loop", () => {
  const stops = [
    { id: "a", distanceM: 10, priority: 1 },
    { id: "b", distanceM: 30, priority: 2 },
    { id: "c", distanceM: 80, priority: 3 },
  ];
  const none = new Set<string>();
  assert.equal(nextTaskAhead(stops, 0, 100, none)?.id, "a");
  assert.equal(nextTaskAhead(stops, 10, 100, none)?.id, "a");
  assert.equal(nextTaskAhead(stops, 20, 100, none)?.id, "a");
  assert.equal(nextTaskAhead(stops, 26, 100, none)?.id, "b");
  assert.equal(nextTaskAhead(stops, 10, 100, new Set(["a"]))?.id, "b");
  assert.equal(nextTaskAhead(stops, 90, 100, none)?.id, "c");
  assert.equal(nextTaskAhead(stops, 96, 100, none)?.id, "a");
  assert.equal(nextTaskAhead(stops, 40, 100, new Set(["b", "c"]))?.id, "a");
  assert.equal(nextTaskAhead(stops, 0, 100, new Set(["a", "b", "c"])), null);
  assert.equal(nextTaskAhead([], 0, 100, none), null);
  assert.equal(nextTaskAhead(stops, 0, 0, none), null);
});

test("walk query and done keys", () => {
  assert.equal(parseWalkParam(undefined), "inspector");
  assert.equal(parseWalkParam("farmer"), "farmer");
  assert.equal(parseWalkParam(["farmer"]), "farmer");
  assert.equal(parseWalkParam("nope"), "inspector");
  assert.equal(parseBlockParam("V02"), "V02");
  assert.equal(parseBlockParam(" ../V02"), null);
  assert.equal(parseBlockParam(""), null);
  assert.equal(walkHref("inspector", null), "/walks");
  assert.equal(walkHref("farmer", null), "/walks?walk=farmer");
  assert.equal(walkHref("inspector", "V02"), "/walks?block=V02");
  assert.equal(walkHref("farmer", "V02"), "/walks?walk=farmer&block=V02");
  assert.equal(doneStorageKey("GAP-V04-R032-01"), "dementra.walk.done.GAP-V04-R032-01");
});
