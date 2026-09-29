// @ts-expect-error Node's test runner needs a .ts specifier, which tsc rejects.
import { pointAtDistance, snapToRoute } from "../route-path.ts";
import type { Coordinate, RoutePath } from "../route-path";

export function positionAlongLine(path: RoutePath, distanceM: number): { point: Coordinate; distanceM: number; fraction: number } {
  const length = path.lengthM;
  const distance = !Number.isFinite(distanceM) || !Number.isFinite(length) ? 0 : Math.max(0, Math.min(length, distanceM));
  return {
    point: pointAtDistance(path, distance),
    distanceM: distance,
    fraction: length > 0 ? distance / length : 0,
  };
}

/** Split the walk into the solid travelled part and the dashed part still ahead. */
export function sliceRoute(path: RoutePath, distanceM: number): { walked: Coordinate[]; remaining: Coordinate[] } {
  const length = path.lengthM;
  const distance = !Number.isFinite(distanceM) || !Number.isFinite(length) ? 0 : Math.max(0, Math.min(length, distanceM));
  if (distance <= 0) return { walked: [], remaining: path.coordinates.slice() };
  if (distance >= length) return { walked: path.coordinates.slice(), remaining: [] };
  const cut = pointAtDistance(path, distance);
  const walked: Coordinate[] = [];
  const remaining: Coordinate[] = [cut];
  for (let i = 0; i < path.coordinates.length; i += 1) {
    const at = path.cumulative[i] ?? 0;
    const point = path.coordinates[i];
    if (!point) continue;
    if (at < distance) walked.push(point);
    else if (at > distance) remaining.push(point);
  }
  walked.push(cut);
  return { walked, remaining };
}

export function boundsOf(coordinates: readonly Coordinate[]): [[number, number], [number, number]] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of coordinates) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (lon < west) west = lon;
    if (lat < south) south = lat;
    if (lon > east) east = lon;
    if (lat > north) north = lat;
  }
  if (!Number.isFinite(west)) return null;
  return [[west, south], [east, north]];
}

export function lineFeatureCollection(coordinates: readonly Coordinate[]) {
  if (coordinates.length < 2) return { type: "FeatureCollection" as const, features: [] };
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: coordinates.map((point) => [point[0], point[1]]) },
      },
    ],
  };
}

export function pointFeatureCollection(point: Coordinate) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Point" as const, coordinates: [point[0], point[1]] as Coordinate },
      },
    ],
  };
}

export function withRouteDistance<T extends { at: Coordinate }>(path: RoutePath, tasks: readonly T[]): Array<T & { distanceM: number }> {
  return tasks.map((task) => ({ ...task, distanceM: snapToRoute(path, task.at).distance }));
}
