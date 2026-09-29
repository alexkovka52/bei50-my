import { strict as assert } from "node:assert";
import { test } from "node:test";
import { shouldLoadPlants } from "./plants.ts";

test("plants stay unloaded until the map is close enough and the layer is on", () => {
  assert.equal(shouldLoadPlants(15.9, true), false);
  assert.equal(shouldLoadPlants(16, true), true);
  assert.equal(shouldLoadPlants(18, false), false);
  assert.equal(shouldLoadPlants(Number.NaN, true), false);
});
