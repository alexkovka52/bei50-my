import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatWalkKm, timeLeftLabel } from "./format.ts";

test("formatWalkKm keeps two decimals from the measured length", () => {
  assert.equal(formatWalkKm(7991.683), "7.99 km");
  assert.equal(formatWalkKm(4293.173), "4.29 km");
  assert.equal(formatWalkKm(2720, false), "2.72");
  assert.equal(formatWalkKm(0), "0.00 km");
  assert.equal(formatWalkKm(-1), "Not measured");
  assert.equal(formatWalkKm(Number.NaN), "Not measured");
});

test("timeLeftLabel is the on-foot remainder", () => {
  assert.equal(timeLeftLabel(8000), "about 2 h left");
  assert.equal(timeLeftLabel(7991.683 * 0.66), "about 1 h 19 min left");
  assert.equal(timeLeftLabel(0), "about 0 min left");
  assert.equal(timeLeftLabel(-4), "Not measured");
});
