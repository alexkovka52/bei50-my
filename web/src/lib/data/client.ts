import { asset } from "@/lib/base-path";
import type { LayerName, RouteRole } from "@/lib/data/types";

export function dataUrl(file: string): string {
  const clean = file.replace(/^\/+/, "");
  return asset(`/data/${clean}`);
}

export function layerUrl(name: LayerName): string {
  return dataUrl(`layers/${name}.geojson`);
}

export function routeUrl(role: RouteRole): string {
  return dataUrl(`routes/${role}.geojson`);
}
