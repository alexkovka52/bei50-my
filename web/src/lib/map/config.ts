import { asset } from "@/lib/base-path";

/** Self-hosted drone imagery (scripts/build_ortho_tiles.sh → nginx /tiles/ortho/). */
export const ORTHO_TILES = process.env.NEXT_PUBLIC_ORTHO_URL || asset("/tiles/ortho/{z}/{x}/{y}.webp");
export const ORTHO_FALLBACK =
  "https://api.imagery.hotosm.org/raster/collections/openaerialmap/items/683060c4025981aa411253c8/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=visual";
/** From dist/tiles/ortho/metadata.json. */
export const ORTHO_BOUNDS: [number, number, number, number] = [28.7009351, 47.1135363, 28.7231667, 47.1312467];
export const ORTHO_MINZOOM = 14;
export const ORTHO_MAXZOOM = 21;

export const ESRI_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export const ATTRIBUTION = [
  "Imagery CC BY 4.0 3DATA COLLECT / OpenAerialMap",
  "Esri, Maxar, Earthstar Geographics",
  "Terrain: Mapzen / AWS Open Data",
  "Passages © OpenStreetMap contributors (ODbL)",
].join(", ");

/** Spec defaults: 3D pitch 58°, bearing −10°, terrain exaggeration 1.5. */
export const VIEW_3D = { pitch: 58, bearing: -10, exaggeration: 1.5 } as const;
export const VIEW_2D = { pitch: 0, bearing: 0 } as const;

/** Design tokens mirrored for MapLibre paint (keep in sync with globals.css @theme). */
export const MAP_COLORS = {
  forest: "#0F2A1D",
  moss: "#375534",
  dew: "#E3EED4",
  lichen: "#AEC3B0",
  budbreak: "#D6F26B",
  canopy: "#4E8A4A",
  gap: "#E09A2D",
  waste: "#C9432F",
  soil: "#A9825A",
  mixed: "#B4B65A",
  vegetation: "#6B9071",
  unset: "#D9E4CD",
  inspector: "#D6F26B",
  farmer: "#E3EED4",
} as const;

export const WORKER_URL = () => `${window.location.origin}${asset("/maplibre-gl-worker.mjs")}`;
