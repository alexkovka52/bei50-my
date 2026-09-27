import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseStart, utm35nToLonLat } from "./geo.ts";

const PRETEST_UTM = ["629663.8", "5220195.3"] as const;
const PRETEST_WGS = [28.7094577, 47.1225039] as const;
const OFFICIAL_UTM = ["629504.70", "5220250.75"] as const;
const OFFICIAL_WGS = [28.7073776, 47.1230335] as const;

test("parseStart keeps WGS84 lon/lat", () => {
  const pt = parseStart(PRETEST_WGS[0].toString(), PRETEST_WGS[1].toString());
  assert.ok(pt);
  assert.ok(Math.abs(pt[0] - PRETEST_WGS[0]) < 1e-7);
  assert.ok(Math.abs(pt[1] - PRETEST_WGS[1]) < 1e-7);
});

test("parseStart accepts organizer pretest UTM 35N", () => {
  const pt = parseStart(...PRETEST_UTM);
  assert.ok(pt, "UTM pretest must not be rejected");
  assert.ok(Math.abs(pt[0] - PRETEST_WGS[0]) < 1e-5);
  assert.ok(Math.abs(pt[1] - PRETEST_WGS[1]) < 1e-5);
});

test("parseStart converts official start UTM to the known WGS84", () => {
  const pt = parseStart(...OFFICIAL_UTM);
  assert.ok(pt);
  const via = utm35nToLonLat(Number(OFFICIAL_UTM[0]), Number(OFFICIAL_UTM[1]));
  assert.ok(Math.abs(pt[0] - via[0]) < 1e-9);
  assert.ok(Math.abs(pt[1] - via[1]) < 1e-9);
  assert.ok(Math.abs(pt[0] - OFFICIAL_WGS[0]) < 1e-5);
  assert.ok(Math.abs(pt[1] - OFFICIAL_WGS[1]) < 1e-5);
});

test("parseStart rejects garbage", () => {
  assert.equal(parseStart("abc", "47"), null);
});
