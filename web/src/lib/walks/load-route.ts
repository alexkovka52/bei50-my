import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LonLat } from "../data/types";
import { readRoute } from "../route-path";
import type { WalkRole } from "./tasks";

export type WalkRouteData = {
  coordinates: LonLat[];
  lengthM: number;
  targetsTotal: number | null;
  targetsVisited: number | null;
};

function countOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function loadWalkRoute(role: WalkRole): Promise<WalkRouteData | null> {
  if (role !== "inspector" && role !== "farmer") return null;
  try {
    const file = path.join(process.cwd(), "public", "data", "routes", `${role}.geojson`);
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || !("features" in parsed) || !Array.isArray(parsed.features)) return null;
    const route = readRoute(parsed.features);
    if (!route || route.coordinates.length < 2 || !(route.lengthM > 0)) return null;
    const line = parsed.features.find(
      (feature) => feature && typeof feature === "object" && "geometry" in feature && feature.geometry && typeof feature.geometry === "object" && "type" in feature.geometry && feature.geometry.type === "LineString",
    );
    const props =
      line && typeof line === "object" && "properties" in line && line.properties && typeof line.properties === "object"
        ? (line.properties as Record<string, unknown>)
        : {};
    return {
      coordinates: route.coordinates,
      lengthM: route.lengthM,
      targetsTotal: countOrNull(props.targets_total),
      targetsVisited: countOrNull(props.targets_visited),
    };
  } catch {
    return null;
  }
}
