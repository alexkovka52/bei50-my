import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LonLat } from "../data/types";
import { readRoute } from "../route-path";
import type { WalkRole } from "./tasks";

export type WalkRouteData = {
  coordinates: LonLat[];
  lengthM: number;
};

export async function loadWalkRoute(role: WalkRole): Promise<WalkRouteData | null> {
  if (role !== "inspector" && role !== "farmer") return null;
  try {
    const file = path.join(process.cwd(), "public", "data", "routes", `${role}.geojson`);
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || !("features" in parsed) || !Array.isArray(parsed.features)) return null;
    const route = readRoute(parsed.features);
    if (!route || route.coordinates.length < 2 || !(route.lengthM > 0)) return null;
    return { coordinates: route.coordinates, lengthM: route.lengthM };
  } catch {
    return null;
  }
}
