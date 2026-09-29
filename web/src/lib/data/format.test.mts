import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatDay, formatDuration, formatHa, formatInt, formatKm, formatPct } from "./format.ts";

test("formatInt groups thousands", () => {
  assert.equal(formatInt(13308), "13,308");
  assert.equal(formatInt(1000000), "1,000,000");
  assert.equal(formatInt(0), "0");
  assert.equal(formatInt(Number.NaN), "Not measured");
});

test("formatKm turns metres into one decimal kilometre", () => {
  assert.equal(formatKm(39100), "39.1 km");
  assert.equal(formatKm(0), "0.0 km");
  assert.equal(formatKm(1000), "1.0 km");
  assert.equal(formatKm(-1), "Not measured");
  assert.equal(formatKm(Number.POSITIVE_INFINITY), "Not measured");
});

test("formatHa keeps up to two decimals", () => {
  assert.equal(formatHa(21.8), "21.8 ha");
  assert.equal(formatHa(145), "145 ha");
  assert.equal(formatHa(1.15), "1.15 ha");
  assert.equal(formatHa(1), "1 ha");
  assert.equal(formatHa(-2), "Not measured");
});

test("formatPct prints percent points", () => {
  assert.equal(formatPct(38), "38%");
  assert.equal(formatPct(36), "36%");
  assert.equal(formatPct(83.4), "83.4%");
  assert.equal(formatPct(Number.NaN), "Not measured");
});

test("formatDuration walks at 4 km/h by default", () => {
  assert.equal(formatDuration(8000), "2 h");
  assert.equal(formatDuration(8000, 4), "2 h");
  assert.equal(formatDuration((79 / 60) * 4000), "1 h 19 min");
  assert.equal(formatDuration(2000), "30 min");
  assert.equal(formatDuration(0), "0 min");
  assert.equal(formatDuration(10000, 5), "2 h");
  assert.equal(formatDuration(-5), "Not measured");
  assert.equal(formatDuration(1000, 0), "Not measured");
});

test("formatDay renders a flight date", () => {
  assert.equal(formatDay("2026-09-20"), "20 Sep 2026");
  assert.equal(formatDay("not-a-date"), "Not measured");
});
