import type { Map as MlMap, StyleSpecification } from "maplibre-gl";
import { layerUrl } from "@/lib/data/client";
import type { LayerName } from "@/lib/data/types";
import { shouldLoadPlants } from "@/lib/map/plants";
import {
  ATTRIBUTION,
  ESRI_TILES,
  MAP_COLORS as C,
  ORTHO_BOUNDS,
  ORTHO_MAXZOOM,
  ORTHO_MINZOOM,
  ORTHO_TILES,
  TERRAIN_TILES,
} from "./config";

/**
 * Base style: forest background, dimmed Esri context, the self-hosted drone ortho on top, and a
 * terrain DEM source (enable it with `map.setTerrain({ source: "terrain", exaggeration })`).
 */
export function baseStyle({ dark = true }: { dark?: boolean } = {}): StyleSpecification {
  return {
    version: 8,
    sources: {
      esri: { type: "raster", tiles: [ESRI_TILES], tileSize: 256, maxzoom: 19, attribution: ATTRIBUTION },
      ortho: {
        type: "raster",
        tiles: [ORTHO_TILES],
        tileSize: 256,
        bounds: ORTHO_BOUNDS,
        minzoom: ORTHO_MINZOOM,
        maxzoom: ORTHO_MAXZOOM,
      },
      terrain: { type: "raster-dem", tiles: [TERRAIN_TILES], tileSize: 256, maxzoom: 15, encoding: "terrarium" },
    },
    sky: {
      "sky-color": dark ? C.forest : C.dew,
      "horizon-color": dark ? "#1E3A2B" : "#F8FBF3",
      "fog-color": dark ? C.forest : C.dew,
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.5,
      "fog-ground-blend": 0.35,
      "atmosphere-blend": 0,
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": dark ? C.forest : C.dew } },
      {
        id: "esri",
        type: "raster",
        source: "esri",
        paint: { "raster-saturation": -0.55, "raster-brightness-max": dark ? 0.62 : 0.85, "raster-contrast": -0.1 },
      },
      { id: "ortho", type: "raster", source: "ortho", paint: { "raster-opacity": 1, "raster-fade-duration": 150 } },
    ],
  };
}

/** Layer ids per data layer, so UIs can toggle a data layer as one unit. */
export const DATA_LAYER_IDS: Record<LayerName, string[]> = {
  forbidden: ["forbidden-fill", "forbidden-line"],
  passages: ["passages-line"],
  interrows: ["interrows-fill"],
  blocks: ["blocks-fill", "blocks-line", "blocks-selected"],
  plants: ["plants-fill"],
  rows: ["rows-line"],
  waste: ["waste-circle"],
  gaps: ["gaps-circle"],
};

export const DEFAULT_VISIBLE: Record<LayerName, boolean> = {
  forbidden: false,
  passages: false,
  interrows: false,
  blocks: true,
  plants: true,
  rows: true,
  waste: true,
  gaps: true,
};

const plantsWanted = new WeakMap<MlMap, boolean>();

function mountPlants(map: MlMap): void {
  if (!map.getSource("plants")) map.addSource("plants", { type: "geojson", data: layerUrl("plants"), promoteId: "id" });
  if (map.getLayer("plants-fill")) return;
  const before = map.getLayer("rows-line") ? "rows-line" : undefined;
  map.addLayer(
    {
      id: "plants-fill",
      type: "fill",
      source: "plants",
      minzoom: 16,
      layout: { visibility: "visible" },
      paint: { "fill-color": C.canopy, "fill-opacity": 0.55, "fill-outline-color": "#BFE3A3" },
    },
    before,
  );
}

/** Fetch plants.geojson only once the canopy marks are useful, then keep the chosen visibility. */
export function syncPlants(map: MlMap): void {
  const wanted = plantsWanted.get(map) ?? false;
  if (!shouldLoadPlants(map.getZoom(), wanted)) {
    if (!wanted && map.getLayer("plants-fill")) map.setLayoutProperty("plants-fill", "visibility", "none");
    return;
  }
  mountPlants(map);
  if (map.getLayer("plants-fill")) map.setLayoutProperty("plants-fill", "visibility", "visible");
}

/**
 * Adds every data layer (GeoJSON from web/public/data/layers) in draw order.
 * The plants source waits until zoom 16. Selection: call `setSelectedBlock(map, id)`.
 */
export function addDataLayers(map: MlMap, visible: Partial<Record<LayerName, boolean>> = {}): void {
  const vis = { ...DEFAULT_VISIBLE, ...visible };
  plantsWanted.set(map, vis.plants);
  const v = (name: LayerName) => (vis[name] ? "visible" : "none") as "visible" | "none";
  const names: LayerName[] = ["forbidden", "passages", "interrows", "blocks", "rows", "waste", "gaps"];
  for (const name of names) {
    if (!map.getSource(name)) map.addSource(name, { type: "geojson", data: layerUrl(name), promoteId: "id" });
  }
  map.addLayer({ id: "forbidden-fill", type: "fill", source: "forbidden", layout: { visibility: v("forbidden") },
    paint: { "fill-color": C.waste, "fill-opacity": 0.18 } });
  map.addLayer({ id: "forbidden-line", type: "line", source: "forbidden", layout: { visibility: v("forbidden") },
    paint: { "line-color": C.waste, "line-width": 1.5, "line-dasharray": [2, 2] } });
  map.addLayer({ id: "passages-line", type: "line", source: "passages", layout: { visibility: v("passages") },
    paint: { "line-color": C.dew, "line-width": 1.2, "line-opacity": 0.7, "line-dasharray": [3, 2] } });
  map.addLayer({ id: "interrows-fill", type: "fill", source: "interrows", layout: { visibility: v("interrows") },
    paint: {
      "fill-color": ["match", ["get", "cover"], "bare_soil", C.soil, "vegetation", C.vegetation, "mixed", C.mixed, C.unset],
      "fill-opacity": 0.45,
    } });
  map.addLayer({ id: "blocks-fill", type: "fill", source: "blocks", layout: { visibility: v("blocks") },
    paint: { "fill-color": C.budbreak, "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.1, 0] } });
  map.addLayer({ id: "blocks-line", type: "line", source: "blocks", layout: { visibility: v("blocks") },
    paint: { "line-color": C.dew, "line-width": 1, "line-opacity": 0.45 } });
  map.addLayer({ id: "blocks-selected", type: "line", source: "blocks", layout: { visibility: v("blocks") },
    filter: ["==", ["get", "id"], ""], paint: { "line-color": C.budbreak, "line-width": 2.5 } });
  map.addLayer({ id: "rows-line", type: "line", source: "rows", layout: { visibility: v("rows"), "line-cap": "round" },
    paint: {
      "line-color": ["match", ["get", "structure"], "disrupted", C.gap, C.dew],
      "line-width": ["interpolate", ["linear"], ["zoom"], 15, 0.4, 17, 0.8, 20, 2.4],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0.35, 18, 0.7],
    } });
  map.addLayer({ id: "waste-circle", type: "circle", source: "waste", layout: { visibility: v("waste") },
    paint: { "circle-color": C.waste, "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 3, 20, 8],
      "circle-stroke-color": C.forest, "circle-stroke-width": 2 } });
  map.addLayer({ id: "gaps-circle", type: "circle", source: "gaps", layout: { visibility: v("gaps") },
    paint: { "circle-color": C.gap, "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 1.5, 17, 2.5, 19, 5, 21, 8],
      "circle-stroke-color": C.forest, "circle-stroke-width": 1.5 } });
  syncPlants(map);
  map.on("zoomend", () => syncPlants(map));
}

export function setDataLayerVisible(map: MlMap, name: LayerName, on: boolean): void {
  if (name === "plants") {
    plantsWanted.set(map, on);
    syncPlants(map);
    return;
  }
  for (const id of DATA_LAYER_IDS[name]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }
}

export function setSelectedBlock(map: MlMap, id: string | null): void {
  if (map.getLayer("blocks-selected")) map.setFilter("blocks-selected", ["==", ["get", "id"], id ?? ""]);
}
