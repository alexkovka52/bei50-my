export type RouteRole = "inspector" | "farmer";
export type Coordinate = [number, number];
export type RoutePath = { coordinates: Coordinate[]; cumulative: number[]; lengthM: number; scale: number };
export type RouteEndpoints = { start: number; end: number; customEnd: boolean };

export function distanceM(a: Coordinate, b: Coordinate) {
  const rad = Math.PI / 180;
  const lat = (a[1] + b[1]) * rad / 2;
  return 6371008.8 * Math.hypot((b[0] - a[0]) * rad * Math.cos(lat), (b[1] - a[1]) * rad);
}

export function createRoutePath(coordinates: Coordinate[], measuredLength?: number): RoutePath {
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i++) cumulative.push(cumulative[i - 1] + distanceM(coordinates[i - 1], coordinates[i]));
  const rawLength = cumulative[cumulative.length - 1] || 0;
  const scale = measuredLength && measuredLength > 0 && rawLength > 0 ? measuredLength / rawLength : 1;
  return { coordinates, cumulative: cumulative.map((n) => n * scale), lengthM: rawLength * scale, scale };
}

export function readRoute(features?: Array<{ geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> }>): RoutePath | null {
  const line = features?.find((f) => f.geometry?.type === "LineString");
  const raw = line?.geometry?.coordinates;
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const coordinates: Coordinate[] = raw.map((p) => [Number(p[0]), Number(p[1])]);
  if (coordinates.some((p) => !p.every(Number.isFinite))) return null;
  return createRoutePath(coordinates, Number(line?.properties?.length_m));
}

export function pointAtDistance(path: RoutePath, distance: number): Coordinate {
  const d = Math.max(0, Math.min(path.lengthM, distance));
  let lo = 0;
  let hi = path.cumulative.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (path.cumulative[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  if (!lo) return path.coordinates[0];
  const segment = path.cumulative[lo] - path.cumulative[lo - 1];
  const t = segment ? (d - path.cumulative[lo - 1]) / segment : 0;
  const a = path.coordinates[lo - 1];
  const b = path.coordinates[lo];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Snap to an existing walked segment, rather than drawing a connector across fields. */
export function snapToRoute(path: RoutePath, point: Coordinate) {
  const cos = Math.cos(point[1] * Math.PI / 180);
  let best = { point: path.coordinates[0], distance: 0, offsetM: Infinity };
  for (let i = 1; i < path.coordinates.length; i++) {
    const a = path.coordinates[i - 1];
    const b = path.coordinates[i];
    const dx = (b[0] - a[0]) * cos;
    const dy = b[1] - a[1];
    const denominator = dx * dx + dy * dy;
    const t = denominator ? Math.max(0, Math.min(1, (((point[0] - a[0]) * cos) * dx + (point[1] - a[1]) * dy) / denominator)) : 0;
    const projected: Coordinate = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const offsetM = distanceM(projected, point);
    if (offsetM < best.offsetM) best = { point: projected, distance: path.cumulative[i - 1] + t * (path.cumulative[i] - path.cumulative[i - 1]), offsetM };
  }
  return best;
}

function section(path: RoutePath, from: number, to: number) {
  return [pointAtDistance(path, from), ...path.coordinates.filter((_, i) => path.cumulative[i] > from && path.cumulative[i] < to), pointAtDistance(path, to)];
}

function forward(path: RoutePath, from: number, to: number) {
  return to >= from ? section(path, from, to) : [...section(path, from, path.lengthM), ...section(path, 0, to).slice(1)];
}

/** Keep the complete inspection walk, rotate its start, then walk to the selected finish. */
export function routeWithEndpoints(path: RoutePath, endpoints: RouteEndpoints): RoutePath {
  if (!path.lengthM || (!endpoints.start && !endpoints.end)) return path;
  const start = Math.max(0, Math.min(path.lengthM, endpoints.start)) % path.lengthM;
  const end = Math.max(0, Math.min(path.lengthM, endpoints.end)) % path.lengthM;
  if (distanceM(path.coordinates[0], path.coordinates[path.coordinates.length - 1]) > 1) throw new Error("Endpoint customization requires a closed walk.");
  const full = [...section(path, start, path.lengthM), ...section(path, 0, start).slice(1)];
  const forwardLength = (end - start + path.lengthM) % path.lengthM;
  const backLength = (start - end + path.lengthM) % path.lengthM;
  const extra = forwardLength <= backLength ? forward(path, start, end) : forward(path, end, start).reverse();
  const coordinates = forwardLength < 0.01 || backLength < 0.01 ? full : [...full, ...extra.slice(1)];
  return createRoutePath(coordinates, path.lengthM + Math.min(forwardLength, backLength));
}

export function routeFeature(path: RoutePath, role: RouteRole) {
  return { type: "Feature" as const, properties: { kind: "route", role, length_m: path.lengthM }, geometry: { type: "LineString" as const, coordinates: path.coordinates } };
}
