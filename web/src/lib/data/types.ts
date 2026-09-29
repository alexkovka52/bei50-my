/** WGS84 longitude, latitude. */
export type LonLat = [number, number];

/** West, south, east, north. */
export type BBox = [number, number, number, number];

export type CoverCounts = {
  bare_soil: number;
  vegetation: number;
  mixed: number;
  unassessable: number;
  unset: number;
};

/** Inter-row cover. Missing and unknown values are stored as `unset`. */
export type InterrowCover = keyof CoverCounts;

export type StructureCounts = {
  regular: number;
  disrupted: number;
  unassessable: number;
  unset: number;
};

export type WalkLengths = {
  length_m: number;
  stops: number;
};

export type SummarySource = "marcaj-labels" | "model";

export type SummaryCounts = {
  blocks: number;
  rows: number;
  row_pieces: number;
  plants: number;
  interrows: number;
  waste: number;
  gaps: number;
};

export type Summary = {
  version: 1;
  source: SummarySource;
  generated_at: string;
  flown_on: string;
  farm: string;
  area_ha: number;
  tiles: number;
  gsd_m: number;
  center: LonLat;
  bbox: BBox;
  start: LonLat;
  counts: SummaryCounts;
  row_km: number;
  canopy_ha: number;
  interrow_ha: number;
  cover: CoverCounts;
  structure: StructureCounts;
  walks: {
    inspector: WalkLengths;
    farmer: WalkLengths;
  };
};

export type LargestGap = {
  row_id: string;
  row: number;
  gap_m: number;
  at: LonLat;
};

export type Block = {
  id: string;
  rows: number;
  row_km: number;
  plants: number;
  gaps: number;
  waste: number;
  interrow_ha: number;
  canopy_m2: number;
  disrupted_pct: number | null;
  cover: CoverCounts;
  bbox: BBox;
  centroid: LonLat;
  largest_gaps: LargestGap[];
};

export type BlocksFile = {
  version: 1;
  blocks: Block[];
};

export type RowStructure = "regular" | "disrupted" | "unassessable" | null;

export type VineyardRow = {
  id: string;
  block: string | null;
  row: number;
  length_m: number;
  structure: RowStructure;
  pieces: number;
};

export type RowsFile = {
  version: 1;
  rows: VineyardRow[];
};

export type TaskKind = "gap" | "waste";

export type Task = {
  id: string;
  kind: TaskKind;
  block: string | null;
  row_id: string | null;
  row: number | null;
  gap_m: number | null;
  at: LonLat;
  priority: number;
};

export type TasksFile = {
  version: 1;
  tasks: Task[];
};

export type ModelMetric = {
  key: string;
  label: string;
  before: string | null;
  now: string | null;
};

export type ModelFile = {
  version: 1;
  updated_at: string;
  dataset: {
    tiles: number;
    plants: number;
    rows: number;
    interrows: number;
    waste: number;
    split: {
      train: number;
      val: number;
      test: number;
    };
  };
  metrics: ModelMetric[];
};

export type GeoJsonPoint = { type: "Point"; coordinates: LonLat };
export type GeoJsonMultiPoint = { type: "MultiPoint"; coordinates: LonLat[] };
export type GeoJsonLineString = { type: "LineString"; coordinates: LonLat[] };
export type GeoJsonMultiLineString = { type: "MultiLineString"; coordinates: LonLat[][] };
export type GeoJsonPolygon = { type: "Polygon"; coordinates: LonLat[][] };
export type GeoJsonMultiPolygon = { type: "MultiPolygon"; coordinates: LonLat[][][] };

export type GeoJsonGeometry =
  | GeoJsonPoint
  | GeoJsonMultiPoint
  | GeoJsonLineString
  | GeoJsonMultiLineString
  | GeoJsonPolygon
  | GeoJsonMultiPolygon;

export type Feature<G extends GeoJsonGeometry, P> = {
  type: "Feature";
  id?: string | number;
  geometry: G | null;
  properties: P;
};

export type FeatureCollection<G extends GeoJsonGeometry, P> = {
  type: "FeatureCollection";
  features: Array<Feature<G, P>>;
};

export type RouteRole = "inspector" | "farmer";

export type RouteProperties = {
  length_m: number | null;
  role: RouteRole;
  targets_total: number | null;
  targets_visited: number | null;
};

export type RouteCollection = FeatureCollection<GeoJsonLineString, RouteProperties>;

export type PlantProperties = { block: string | null };
export type RowProperties = { id: string; block: string | null; structure: RowStructure };
export type InterrowProperties = { block: string | null; cover: InterrowCover };
export type GapProperties = { id: string; block: string | null; row_id: string; gap_m: number };
export type WasteProperties = { id: string; block: string | null };
export type BlockOutlineProperties = {
  id: string;
  rows: number;
  row_km: number;
  gaps: number;
  waste: number;
};

export type PlantsLayer = FeatureCollection<GeoJsonGeometry, PlantProperties>;
export type RowsLayer = FeatureCollection<GeoJsonGeometry, RowProperties>;
export type InterrowsLayer = FeatureCollection<GeoJsonGeometry, InterrowProperties>;
export type GapsLayer = FeatureCollection<GeoJsonGeometry, GapProperties>;
export type WasteLayer = FeatureCollection<GeoJsonGeometry, WasteProperties>;
export type BlocksLayer = FeatureCollection<GeoJsonGeometry, BlockOutlineProperties>;
export type PassagesLayer = FeatureCollection<GeoJsonGeometry, Record<string, unknown>>;
export type ForbiddenLayer = FeatureCollection<GeoJsonGeometry, Record<string, unknown>>;

export type LayerName = "plants" | "rows" | "interrows" | "gaps" | "waste" | "blocks" | "passages" | "forbidden";
