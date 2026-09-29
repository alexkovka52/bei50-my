import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createRoutePath, pointAtDistance } from "../route-path.ts";
import { boundsOf, lineFeatureCollection, positionAlongLine, sliceRoute, withRouteDistance } from "./position.ts";

const line = createRoutePath([
  [28.7, 47.12],
  [28.71, 47.12],
  [28.72, 47.12],
]);

test("positionAlongLine reports the point and the fraction", () => {
  const start = positionAlongLine(line, 0);
  assert.equal(start.fraction, 0);
  assert.equal(start.point[0], 28.7);
  const mid = positionAlongLine(line, line.lengthM / 2);
  assert.ok(Math.abs(mid.fraction - 0.5) < 1e-9);
  assert.ok(Math.abs(mid.point[0] - pointAtDistance(line, line.lengthM / 2)[0]) < 1e-12);
  const end = positionAlongLine(line, line.lengthM + 50);
  assert.equal(end.fraction, 1);
  assert.equal(end.point[0], 28.72);
});

test("sliceRoute shares the cut between the walked and remaining parts", () => {
  const atStart = sliceRoute(line, 0);
  assert.equal(atStart.walked.length, 0);
  assert.deepEqual(atStart.remaining, line.coordinates);
  const atEnd = sliceRoute(line, line.lengthM);
  assert.deepEqual(atEnd.walked, line.coordinates);
  assert.equal(atEnd.remaining.length, 0);
  const mid = sliceRoute(line, line.lengthM / 2);
  const cut = pointAtDistance(line, line.lengthM / 2);
  assert.equal(mid.walked[0]?.[0], 28.7);
  assert.equal(mid.walked.at(-1)?.[0], cut[0]);
  assert.equal(mid.remaining[0]?.[0], cut[0]);
  assert.equal(mid.remaining.at(-1)?.[0], 28.72);
  assert.equal(lineFeatureCollection(mid.walked).features.length, 1);
  assert.equal(lineFeatureCollection([cut]).features.length, 0);
});

test("boundsOf and route distance use the published line", () => {
  assert.equal(boundsOf([]), null);
  assert.deepEqual(boundsOf(line.coordinates), [
    [28.7, 47.12],
    [28.72, 47.12],
  ]);
  const indexed = withRouteDistance(line, [{ id: "end", at: [28.72, 47.12] as [number, number] }]);
  assert.ok(Math.abs(indexed[0].distanceM - line.lengthM) < 1);
});
