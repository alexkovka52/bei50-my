export type LonLat = [number, number];

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

export function haversineM(a: LonLat, b: LonLat) {
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function bearingDeg(a: LonLat, b: LonLat) {
  const dLon = toRad(b[0] - a[0]);
  const y = Math.sin(dLon) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function lineCoords(fc: { features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }> } | null): LonLat[] {
  const geom = fc?.features?.[0]?.geometry;
  if (!geom) return [];
  const raw = geom.coordinates;
  if (geom.type === "LineString" && Array.isArray(raw)) {
    return (raw as number[][]).filter((c) => c.length >= 2).map((c) => [Number(c[0]), Number(c[1])]);
  }
  if (geom.type === "MultiLineString" && Array.isArray(raw)) {
    return (raw as number[][][]).flat().filter((c) => c.length >= 2).map((c) => [Number(c[0]), Number(c[1])]);
  }
  return [];
}

export function nearestIndex(line: LonLat[], point: LonLat) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < line.length; i += 1) {
    const d = haversineM(line[i], point);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { index: best, meters: bestD };
}

/** Cumulative metres at each vertex. */
export function cumDist(line: LonLat[]) {
  const out = [0];
  for (let i = 1; i < line.length; i += 1) out.push(out[i - 1] + haversineM(line[i - 1], line[i]));
  return out;
}

export function pointAtDistance(line: LonLat[], cum: number[], meters: number): { point: LonLat; bearing: number } {
  if (line.length === 0) return { point: [0, 0], bearing: 0 };
  if (line.length === 1 || meters <= 0) {
    return { point: line[0], bearing: line[1] ? bearingDeg(line[0], line[1]) : 0 };
  }
  const end = cum[cum.length - 1];
  const target = Math.min(Math.max(0, meters), end);
  let i = 1;
  while (i < cum.length && cum[i] < target) i += 1;
  const a = line[i - 1];
  const b = line[i] || a;
  const span = Math.max(1e-6, cum[i] - cum[i - 1]);
  const t = (target - cum[i - 1]) / span;
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    bearing: bearingDeg(a, b),
  };
}

/** Shortest-path blend of compass bearings, 0–360. */
export function lerpBearing(from: number, to: number, t: number) {
  const d = ((to - from + 540) % 360) - 180;
  return (from + d * Math.min(1, Math.max(0, t)) + 360) % 360;
}

export function lerpLonLat(a: LonLat, b: LonLat, t: number): LonLat {
  const k = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

export function parseLonLat(lon: string, lat: string): LonLat | null {
  const x = Number(lon);
  const y = Number(lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return [x, y];
  return null;
}
