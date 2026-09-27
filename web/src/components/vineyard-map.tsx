"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Check,
  Expand,
  Layers3,
  Minimize2,
  Minus,
  Navigation,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Route,
  X,
} from "lucide-react";
import { asset } from "@/lib/base-path";
import { parseStart, toLonLatCollection, utm35nToLonLat } from "@/lib/geo";
import {
  cumDist,
  lerpBearing,
  lerpLonLat,
  lineCoords,
  nearestIndex,
  pointAtDistance,
  type LonLat,
} from "@/lib/walk";

const WALK_MPS = 5.5;
const SPEEDS = [0.5, 1, 2, 4, 8] as const;
type WalkSpeed = (typeof SPEEDS)[number];

const SIRET3_XYZ =
  "https://api.imagery.hotosm.org/raster/collections/openaerialmap/items/683060c4025981aa411253c8/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=visual";

/** Official start in WGS84 (data/challenge/02_route/start.geojson). */
const OFFICIAL_START: [number, number] = [28.7073776, 47.1230335];
/** Organizer pre-test point (UTM 35N). Not the walk start. */
const PRETEST_UTM = { x: "629663.8", y: "5220195.3" };
const PRETEST_WGS: [number, number] = utm35nToLonLat(629663.8, 5220195.3);

/** Study area of the 311 tiles (data/challenge/02_route/study_area.geojson). */
const STUDY_BOUNDS: [[number, number], [number, number]] = [
  utm35nToLonLat(628980, 5219160),
  utm35nToLonLat(630745, 5220980),
];

type FooterPane = "survey" | "inspect" | "plan" | "layers";

type Status = "loading" | "ready" | "error" | "empty";
type WalkMode = "inspector" | "farmer" | "both";
type MobileSheet = "layers" | "summary" | "planner" | "selected" | null;

type Totals = {
  vineyard: number;
  row: number;
  waste: number;
  nBlocks?: string;
  nRows?: string;
  canopyHa?: string;
  interrowHa?: string;
  rowLengthM?: string;
  inspectorM?: string;
  farmerM?: string;
};

type LayerKey =
  | "vineyard"
  | "interrow"
  | "row"
  | "waste"
  | "forbidden"
  | "passage"
  | "inspection"
  | "inspector"
  | "farmer";

type Selected = {
  title: string;
  kind: string;
  vineyardId?: string;
  rowId?: string;
  lengthM?: number;
  structure?: string;
  cover?: string;
  note?: string;
};

const LAYER_MAP: Record<LayerKey, string[]> = {
  vineyard: ["vineyard-fill", "vineyard-pt"],
  interrow: ["interrow-fill"],
  row: ["row-line"],
  waste: ["waste-fill"],
  forbidden: ["forbidden-fill"],
  passage: ["passage-fill"],
  inspection: ["inspection-pt"],
  inspector: ["inspector-line"],
  farmer: ["farmer-line"],
};

const LAYER_DEFS: Array<{ key: LayerKey; label: string; swatch: string; legend: string }> = [
  { key: "vineyard", label: "Canopy", swatch: "canopy", legend: "Canopy" },
  { key: "row", label: "Rows", swatch: "row", legend: "Row" },
  { key: "interrow", label: "Inter-row", swatch: "interrow", legend: "Inter-row" },
  { key: "waste", label: "Waste", swatch: "waste", legend: "Waste" },
  { key: "inspector", label: "Inspector", swatch: "inspector", legend: "Inspector" },
  { key: "farmer", label: "Farmer", swatch: "farmer", legend: "Farmer" },
  { key: "inspection", label: "Inspections", swatch: "inspection", legend: "Inspection" },
  { key: "forbidden", label: "Forbidden", swatch: "forbidden", legend: "Forbidden" },
  { key: "passage", label: "Passages", swatch: "passage", legend: "Passage" },
];

type Fc = {
  type?: string;
  features?: Array<{
    properties?: Record<string, unknown>;
    geometry?: { type?: string; coordinates?: unknown };
  }>;
};

async function fetchJson(url: string): Promise<Fc | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

function isSampleFeature(f: { properties?: Record<string, unknown> }) {
  return f.properties?.sample === true || f.properties?.sample === "true";
}

function parseCsv(text: string): Totals {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { vineyard: 0, row: 0, waste: 0 };
  const header = lines[0].split(",");
  const idx = (name: string) => header.indexOf(name);
  const kindI = idx("kind");
  const nI = idx("n_parts");
  const areaI = idx("area_m2");
  const lenI = idx("length_m");
  const out: Totals = { vineyard: 0, row: 0, waste: 0 };
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const kind = cols[kindI] || "";
    if (kind === "n_blocks") out.nBlocks = cols[nI];
    if (kind === "n_rows") out.nRows = cols[nI];
    if (kind === "canopy_union" && cols[areaI]) out.canopyHa = (Number(cols[areaI]) / 10000).toFixed(4);
    if (kind === "interrow_union" && cols[areaI]) out.interrowHa = (Number(cols[areaI]) / 10000).toFixed(4);
    if (kind === "total_row_length") out.rowLengthM = cols[lenI];
    if (kind === "vineyard") out.vineyard += 1;
    if (kind === "row") out.row += 1;
    if (kind === "waste") out.waste += 1;
  }
  return out;
}

function fmtM(value?: string) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} m`;
}

function fmtHa(value?: string) {
  if (value == null || value === "") return "—";
  return `${value} ha`;
}

function fmtKmFromM(value?: string) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `${(n / 1000).toFixed(2)} km`;
}

function applyLayerVisibility(map: import("maplibre-gl").Map, layers: Record<LayerKey, boolean>) {
  for (const [key, ids] of Object.entries(LAYER_MAP) as Array<[LayerKey, string[]]>) {
    const vis = layers[key] ? "visible" : "none";
    for (const id of ids) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    }
  }
}

function selectedFromClick(layerId: string, props: Record<string, unknown>): Selected {
  const kind = String(props.kind || layerId);
  const vineyardId = props.vineyard_id ? String(props.vineyard_id) : undefined;
  const rowId = props.row_id ? String(props.row_id) : undefined;
  const structure = props.row_structure ? String(props.row_structure) : undefined;
  const cover = props.interrow_cover ? String(props.interrow_cover) : undefined;
  const lengthM = props.length_m != null && props.length_m !== "" ? Number(props.length_m) : undefined;
  const titles: Record<string, string> = {
    vineyard: "Canopy",
    row: "Selected Row",
    interrow_area: "Inter-row Area",
    waste: "Waste",
    inspection: "Inspection Point",
    start: "Official start",
    forbidden: "Forbidden zone",
    passage: "Authorized passage",
  };
  let title = titles[kind] || kind;
  if (kind === "route") title = layerId.includes("farmer") ? "Farmer walk" : "Inspector walk";
  let note: string | undefined;
  if (kind === "start") note = "47.1230335 N, 28.7073776 E";
  if (props.area_m2 != null) note = `${props.area_m2} m²`;
  if (cover) note = cover;
  return { title, kind, vineyardId, rowId, structure, cover, lengthM, note };
}

export function VineyardMap() {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const workspace = useRef<HTMLElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | undefined>(undefined);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [reload, setReload] = useState(0);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    vineyard: true,
    interrow: true,
    row: true,
    waste: true,
    forbidden: true,
    passage: true,
    inspection: false,
    inspector: true,
    farmer: false,
  });
  const [totals, setTotals] = useState<Totals>({ vineyard: 0, row: 0, waste: 0 });
  const [sampleMode, setSampleMode] = useState(true);
  const [panelsVisible] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [footer, setFooter] = useState<FooterPane>("survey");
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [walkMode, setWalkMode] = useState<WalkMode>("both");
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const [mapZoom, setMapZoom] = useState(17.6);
  const [sheet, setSheet] = useState<MobileSheet>(null);
  const [startLon, setStartLon] = useState(String(OFFICIAL_START[0]));
  const [startLat, setStartLat] = useState(String(OFFICIAL_START[1]));
  const [pickStart, setPickStart] = useState(false);
  const [walkUi, setWalkUi] = useState<"idle" | "playing" | "paused">("idle");
  const [speed, setSpeed] = useState<WalkSpeed>(1);
  const walkBearing = useRef(0);
  const walkCam = useRef<LonLat | null>(null);
  const walksRef = useRef<{ inspector: LonLat[]; farmer: LonLat[] }>({ inspector: [], farmer: [] });
  const pickStartRef = useRef(false);
  const playRaf = useRef(0);
  const speedRef = useRef<WalkSpeed>(1);
  const walkRef = useRef<{
    line: LonLat[];
    cum: number[];
    startM: number;
    endM: number;
    atM: number;
    reduced: boolean;
  } | null>(null);

  useEffect(() => {
    speedRef.current = speed;
    if (walkUi !== "idle") {
      setMessage(`${walkMode === "farmer" ? "Farmer" : "Inspector"} · ${speed}×`);
    }
    // walkUi / walkMode only gate the toast; speed is the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  useEffect(() => {
    pickStartRef.current = pickStart;
  }, [pickStart]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;
    let ro: ResizeObserver | undefined;

    async function boot() {
      setStatus("loading");
      setError("");
      try {
        const maplibre = await import("maplibre-gl");
        if (!mapEl.current || cancelled) return;
        maplibre.config.WORKER_URL = `${window.location.origin}${asset("/maplibre-gl-worker.mjs")}`;

        const [packed, sample, inspectorRaw, farmerRaw, csvText] = await Promise.all([
          fetchJson(asset("/layers/layers.geojson")),
          fetchJson(asset("/layers/sample.geojson")),
          fetchJson(asset("/layers/route.geojson")),
          fetchJson(asset("/layers/route-farmer.geojson")),
          fetch(asset("/layers/measurements.csv")).then((r) => (r.ok ? r.text() : "")),
        ]);
        if (!packed && !sample) throw new Error("no layer GeoJSON in /layers/");

        const packedFc = toLonLatCollection(packed || { features: [] });
        const sampleFc = toLonLatCollection(sample || { features: [] });
        const packedFeats = packedFc.features || [];
        const hasRealCanopy = packedFeats.some((f) => f.properties?.kind === "vineyard");
        const sampleFcFeatures = sampleFc.features || [];
        const sampleData = {
          type: "FeatureCollection",
          features: hasRealCanopy ? packedFeats : [...sampleFcFeatures, ...packedFeats],
        };
        const inspector = toLonLatCollection(inspectorRaw || { features: [] });
        const farmer = toLonLatCollection(farmerRaw || { features: [] });
        walksRef.current = { inspector: lineCoords(inspector), farmer: lineCoords(farmer) };
        setSampleMode(!hasRealCanopy || sampleData.features.some(isSampleFeature));

        const feats = sampleData.features as Array<{ properties?: { kind?: string } }>;
        const parsed = csvText ? parseCsv(csvText) : { vineyard: 0, row: 0, waste: 0 };
        const inspectorM = inspector.features?.[0]?.properties?.length_m;
        const farmerM = farmer.features?.[0]?.properties?.length_m;
        setTotals({
          vineyard: parsed.vineyard || feats.filter((f) => f.properties?.kind === "vineyard").length,
          row: parsed.row || feats.filter((f) => f.properties?.kind === "row").length,
          waste: parsed.waste || feats.filter((f) => f.properties?.kind === "waste").length,
          nBlocks: parsed.nBlocks,
          nRows: parsed.nRows,
          canopyHa: parsed.canopyHa,
          interrowHa: parsed.interrowHa,
          rowLengthM: parsed.rowLengthM,
          inspectorM: inspectorM != null ? String(inspectorM) : undefined,
          farmerM: farmerM != null ? String(farmerM) : undefined,
        });
        setStatus(feats.length ? "ready" : "empty");

        const created = new maplibre.Map({
          container: mapEl.current,
          style: {
            version: 8,
            sources: {
              siret3: {
                type: "raster",
                tiles: [SIRET3_XYZ],
                tileSize: 256,
                attribution: "Sireț3 © 3DATA COLLECT / OIN, CC BY 4.0",
              },
            },
            layers: [
              { id: "bg", type: "background", paint: { "background-color": "#0b0c0b" } },
              { id: "siret3", type: "raster", source: "siret3", paint: { "raster-opacity": 1 } },
            ],
          },
          center: OFFICIAL_START,
          zoom: 17.2,
          minZoom: 15.1,
          maxZoom: 19.6,
          maxBounds: STUDY_BOUNDS,
          renderWorldCopies: false,
          attributionControl: {},
        });
        map = created;
        mapRef.current = created;
        created.on("error", (ev) => {
          const msg = ev.error?.message || "";
          if (msg.includes("Worker") || msg.includes("actors") || msg.includes("Failed to fetch")) return;
        });
        created.on("zoom", () => setMapZoom(created.getZoom()));

        created.on("load", () => {
          if (cancelled) return;
          created.resize();
          created.fitBounds(STUDY_BOUNDS, { padding: 40, duration: 0, maxZoom: 17.4 });
          created.jumpTo({ pitch: 0, bearing: 0 });
          created.addSource("sample", { type: "geojson", data: sampleData as GeoJSON.GeoJSON });
          created.addSource("inspector", { type: "geojson", data: inspector as GeoJSON.GeoJSON });
          created.addSource("farmer", { type: "geojson", data: farmer as GeoJSON.GeoJSON });
          created.addSource("walker", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: OFFICIAL_START },
            },
          });
          created.addSource("start", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: { kind: "start" },
                  geometry: { type: "Point", coordinates: OFFICIAL_START },
                },
              ],
            },
          });
          created.addSource("query-pin", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: OFFICIAL_START },
            },
          });

          created.addLayer({
            id: "vineyard-fill",
            type: "fill",
            source: "sample",
            filter: [
              "all",
              ["==", ["get", "kind"], "vineyard"],
              ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]],
            ],
            paint: { "fill-color": "#166534", "fill-opacity": 0.32 },
          });
          created.addLayer({
            id: "vineyard-pt",
            type: "circle",
            source: "sample",
            filter: [
              "all",
              ["==", ["get", "kind"], "vineyard"],
              ["==", ["geometry-type"], "Point"],
            ],
            paint: { "circle-color": "#166534", "circle-radius": 3.2, "circle-opacity": 0.75 },
          });
          created.addLayer({
            id: "interrow-fill",
            type: "fill",
            source: "sample",
            filter: ["==", ["get", "kind"], "interrow_area"],
            paint: { "fill-color": "#a3e635", "fill-opacity": 0.22 },
          });
          created.addLayer({
            id: "passage-fill",
            type: "fill",
            source: "sample",
            filter: ["==", ["get", "kind"], "passage"],
            paint: { "fill-color": "#94a3b8", "fill-opacity": 0.28 },
          });
          created.addLayer({
            id: "forbidden-fill",
            type: "fill",
            source: "sample",
            filter: ["==", ["get", "kind"], "forbidden"],
            paint: { "fill-color": "#b91c1c", "fill-opacity": 0.4 },
          });
          created.addLayer({
            id: "waste-fill",
            type: "fill",
            source: "sample",
            filter: ["==", ["get", "kind"], "waste"],
            paint: { "fill-color": "#ffa443", "fill-opacity": 0.75 },
          });
          created.addLayer({
            id: "row-line",
            type: "line",
            source: "sample",
            filter: ["==", ["get", "kind"], "row"],
            paint: { "line-color": "#d1fb55", "line-width": 2.2 },
          });
          created.addLayer({
            id: "inspector-line",
            type: "line",
            source: "inspector",
            filter: ["==", ["get", "kind"], "route"],
            paint: { "line-color": "#438bff", "line-width": 3.2, "line-dasharray": [1.6, 1] },
          });
          created.addLayer({
            id: "farmer-line",
            type: "line",
            source: "farmer",
            filter: ["==", ["get", "kind"], "route"],
            paint: { "line-color": "#f05d55", "line-width": 2.8, "line-dasharray": [0.7, 1.3] },
          });
          created.addLayer({
            id: "inspection-pt",
            type: "circle",
            source: "sample",
            filter: ["==", ["get", "kind"], "inspection"],
            paint: { "circle-color": "#38bdf8", "circle-radius": 4.5, "circle-stroke-width": 1, "circle-stroke-color": "#fff" },
          });
          created.addLayer({
            id: "start-pt",
            type: "circle",
            source: "start",
            paint: { "circle-color": "#438bff", "circle-radius": 7, "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
          });
          created.addLayer({
            id: "query-pin",
            type: "circle",
            source: "query-pin",
            paint: { "circle-color": "#2f7a38", "circle-radius": 8, "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
          });
          created.addLayer({
            id: "walker-pt",
            type: "circle",
            source: "walker",
            paint: {
              "circle-color": "#ffffff",
              "circle-radius": 7,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#43a047",
            },
          });
          created.on("click", (e) => {
            if (!pickStartRef.current) return;
            const lon = e.lngLat.lng.toFixed(7);
            const lat = e.lngLat.lat.toFixed(7);
            setStartLon(lon);
            setStartLat(lat);
            setPickStart(false);
            showParsedStart(lon, lat);
          });

          for (const id of [
            "vineyard-fill",
            "vineyard-pt",
            "interrow-fill",
            "waste-fill",
            "row-line",
            "inspector-line",
            "farmer-line",
            "forbidden-fill",
            "passage-fill",
            "inspection-pt",
            "start-pt",
          ]) {
            created.on("mouseenter", id, () => {
              created.getCanvas().style.cursor = "pointer";
            });
            created.on("mouseleave", id, () => {
              created.getCanvas().style.cursor = "";
            });
            created.on("click", id, (e) => {
              const f = e.features?.[0];
              if (!f) return;
              setSelected(selectedFromClick(id, (f.properties || {}) as Record<string, unknown>));
              setSheet("selected");
              setFooter("inspect");
              setPlannerOpen(false);
            });
          }

          applyLayerVisibility(created, layers);
        });
        ro = new ResizeObserver(() => map?.resize());
        if (mapEl.current) ro.observe(mapEl.current);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown map error");
        setStatus("error");
      }
    }

    boot();
    return () => {
      cancelled = true;
      cancelAnimationFrame(playRaf.current);
      ro?.disconnect();
      mapRef.current = undefined;
      map?.remove();
    };
    // layers snapshot is applied on load; later toggles use the second effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyLayerVisibility(map, layers);
  }, [layers]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => mapRef.current?.resize());
    return () => window.cancelAnimationFrame(id);
  }, [footer]);

  function toggleLayer(key: LayerKey) {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function recenter() {
    mapRef.current?.flyTo({ center: OFFICIAL_START, zoom: 17.6 });
  }

  function setQueryPin(pt: LonLat) {
    const src = mapRef.current?.getSource("query-pin") as { setData: (data: GeoJSON.Feature) => void } | undefined;
    src?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: pt },
    });
  }

  function showParsedStart(x = startLon, y = startLat) {
    const pt = parseStart(x, y);
    if (!pt) {
      setMessage("Need WGS84 lon/lat or UTM 35N X/Y");
      return null;
    }
    setQueryPin(pt);
    mapRef.current?.flyTo({ center: pt, zoom: 17.8, pitch: 0, bearing: 0 });
    setMessage(`Pin ${pt[0].toFixed(7)}, ${pt[1].toFixed(7)}`);
    return pt;
  }

  function applyOfficialStart() {
    stopWalk();
    setStartLon(String(OFFICIAL_START[0]));
    setStartLat(String(OFFICIAL_START[1]));
    setPickStart(false);
    showParsedStart(String(OFFICIAL_START[0]), String(OFFICIAL_START[1]));
  }

  function applyPretest() {
    setStartLon(PRETEST_UTM.x);
    setStartLat(PRETEST_UTM.y);
    setPickStart(false);
    const pt = showParsedStart(PRETEST_UTM.x, PRETEST_UTM.y);
    if (pt) setMessage(`Pre-test ${PRETEST_WGS[1].toFixed(7)} N, ${PRETEST_WGS[0].toFixed(7)} E`);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await workspace.current?.requestFullscreen();
    } catch {
      setMessage("Full screen is unavailable in this browser.");
    }
  }

  function activeLine(): LonLat[] {
    if (walkMode === "farmer") return walksRef.current.farmer;
    return walksRef.current.inspector;
  }

  function applyWalkFrame(atM: number, dt: number) {
    const walk = walkRef.current;
    if (!walk) return;
    const walkerPos = pointAtDistance(walk.line, walk.cum, atM);
    const look = pointAtDistance(walk.line, walk.cum, Math.min(walk.endM, atM + 40));
    const camTarget = pointAtDistance(walk.line, walk.cum, Math.max(walk.startM, atM - 22)).point;
    walkCam.current = walkCam.current ? lerpLonLat(walkCam.current, camTarget, Math.min(1, dt * 2.4)) : camTarget;
    walkBearing.current = lerpBearing(walkBearing.current, look.bearing, Math.min(1, dt * 1.35));

    const walker = mapRef.current?.getSource("walker") as { setData?: (d: GeoJSON.GeoJSON) => void } | undefined;
    walker?.setData?.({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: walkerPos.point },
    });
    const map = mapRef.current;
    if (!map) return;
    const span = Math.max(1, walk.endM - walk.startM);
    const intro = Math.min(1, (atM - walk.startM) / 40);
    map.jumpTo({
      center: walkCam.current,
      zoom: walk.reduced ? 16.8 : 17.05,
      pitch: walk.reduced ? 0 : 42 * Math.max(intro, 0.35),
      bearing: walk.reduced ? 0 : walkBearing.current,
    });
    writeProgress((atM - walk.startM) / span);
  }

  function loopWalk(now: number) {
    const walk = walkRef.current;
    if (!walk) return;
    const last = (loopWalk as { last?: number }).last ?? now;
    const dt = Math.min(0.05, (now - last) / 1000);
    (loopWalk as { last?: number }).last = now;
    walk.atM = Math.min(walk.endM, walk.atM + WALK_MPS * speedRef.current * dt);
    applyWalkFrame(walk.atM, dt);
    if (walk.atM >= walk.endM) {
      pauseWalk();
      setMessage("Walk finished");
      return;
    }
    playRaf.current = requestAnimationFrame(loopWalk);
  }

  function writeProgress(ratio: number) {
    const value = String(Math.round(Math.min(1, Math.max(0, ratio)) * 1000));
    document.querySelectorAll<HTMLInputElement>(".walk-progress-input").forEach((el) => {
      if (el.value !== value) el.value = value;
    });
  }

  function pauseWalk() {
    setWalkUi((cur) => (cur === "idle" ? "idle" : "paused"));
    cancelAnimationFrame(playRaf.current);
    playRaf.current = 0;
  }

  function stopWalk() {
    cancelAnimationFrame(playRaf.current);
    playRaf.current = 0;
    walkRef.current = null;
    walkCam.current = null;
    setWalkUi("idle");
    writeProgress(0);
    const map = mapRef.current;
    if (map?.isStyleLoaded()) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 700, essential: true });
    }
  }

  function armWalk(): boolean {
    if (walkMode === "inspector") {
      setLayers((prev) => ({ ...prev, inspector: true, farmer: false }));
    } else if (walkMode === "farmer") {
      setLayers((prev) => ({ ...prev, inspector: false, farmer: true }));
    } else {
      setLayers((prev) => ({ ...prev, inspector: true, farmer: true }));
    }

    const line = activeLine();
    const pinned = parseStart(startLon, startLat) || OFFICIAL_START;
    if (line.length < 2) {
      setMessage("No walk line loaded");
      mapRef.current?.flyTo({ center: pinned, zoom: 16.6 });
      return false;
    }

    const snap = nearestIndex(line, pinned);
    const cum = cumDist(line);
    const startM = cum[snap.index];
    const endM = cum[cum.length - 1];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    walkRef.current = { line, cum, startM, endM, atM: startM, reduced };
    walkBearing.current = pointAtDistance(line, cum, startM).bearing;
    walkCam.current = pointAtDistance(line, cum, Math.max(startM, startM - 22)).point;
    applyWalkFrame(startM, 1);
    writeProgress(0);
    return true;
  }

  function kickWalk() {
    setWalkUi("playing");
    mapRef.current?.stop();
    setMessage(`${walkMode === "farmer" ? "Farmer" : "Inspector"} · ${speedRef.current}×`);
    cancelAnimationFrame(playRaf.current);
    (loopWalk as { last?: number }).last = undefined;
    playRaf.current = requestAnimationFrame(loopWalk);
  }

  function resumeWalk() {
    if (!walkRef.current && !armWalk()) return;
    kickWalk();
  }

  function seekWalk(ratio: number) {
    const walk = walkRef.current;
    if (!walk) return;
    walk.atM = walk.startM + Math.min(1, Math.max(0, ratio)) * (walk.endM - walk.startM);
    applyWalkFrame(walk.atM, 1);
  }

  const blocks = totals.nBlocks ?? String(totals.vineyard || "—");
  const rows = totals.nRows ?? String(totals.row || "—");
  const routeKm =
    walkMode === "farmer"
      ? fmtKmFromM(totals.farmerM)
      : walkMode === "inspector"
        ? fmtKmFromM(totals.inspectorM)
        : fmtKmFromM(totals.inspectorM);
  const selectedRows = selected?.kind === "row";
  const scaleM = Math.round(200 / Math.max(0.4, mapZoom / 16.6));

  return (
    <main className={`workspace ${footer !== "survey" ? "is-footer-open" : ""}`} ref={workspace}>
      <div className={`map-window ${footer !== "survey" ? "is-open" : ""}`}>
        <div className="map-window-bar">
          <span className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="window-title">Sireț3</span>
          <span className="window-meta">{sampleMode ? "Sample" : "Marcaj"}</span>
        </div>
        <div className={`map-stage ${footer !== "survey" ? "is-docked" : ""}`}>
          <div ref={mapEl} className="map-surface" />
          <div className="map-controls flex flex-col" aria-label="Map controls">
            <span className="desktop-only">
              <IconAction
                label="Layers"
                pressed={layersOpen}
                onClick={() => {
                  setLayersOpen((v) => !v);
                  setFooter((cur) => (cur === "layers" ? "survey" : "layers"));
                }}
              >
                <Layers3 size={16} strokeWidth={1.75} />
              </IconAction>
            </span>
            <IconAction label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
              <Plus size={16} />
            </IconAction>
            <IconAction label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
              <Minus size={16} />
            </IconAction>
            <span className="desktop-only">
              <IconAction label="Go to start point" title="Go to start point" onClick={recenter}>
                <Navigation size={16} strokeWidth={1.75} />
              </IconAction>
            </span>
          </div>
        </div>
        <section className={`dark-footer ${footer !== "survey" ? "is-open" : ""}`} aria-label="Survey footer">
          <div className="footer-metrics">
            <span className="metric"><small>Blocks</small><b>{blocks}</b></span>
            <span className="metric"><small>Rows</small><b>{rows}</b></span>
            <span className="metric"><small>Canopy</small><b>{fmtHa(totals.canopyHa)}</b></span>
            <span className="metric"><small>Inter-row</small><b>{fmtHa(totals.interrowHa)}</b></span>
            <span className="metric"><small>Walk</small><b>{routeKm}</b></span>
            <button
              type="button"
              className={footer === "plan" ? "is-active" : ""}
              onClick={() => {
                const open = footer !== "plan";
                setPlannerOpen(open);
                setFooter(open ? "plan" : "survey");
              }}
            >
              Plan
            </button>
          </div>
          {footer === "inspect" && selected && (
            <div className="footer-body">
              <div className="footer-head">
                <h2>{selected.title}</h2>
                <button type="button" onClick={() => { setSelected(null); setFooter("survey"); }} aria-label="Close feature">
                  <X size={16} />
                </button>
              </div>
              <div className="stat-list">
                {selected.vineyardId && <Detail label="Vineyard ID" value={selected.vineyardId} />}
                {selected.rowId && <Detail label="Row ID" value={selected.rowId} />}
                {selected.lengthM != null && !Number.isNaN(selected.lengthM) && (
                  <Detail label="Length" value={`${selected.lengthM.toFixed(1)} m`} />
                )}
                {selected.structure && (
                  <Detail
                    label="Structure"
                    value={selected.structure === "disrupted" ? "Disrupted" : selected.structure}
                    alert={selected.structure === "disrupted"}
                  />
                )}
                {selected.note && <Detail label="Notes" value={selected.note} />}
              </div>
            </div>
          )}
          {footer === "plan" && (
            <div className="footer-body">
              <div className="footer-head">
                <h2>Route</h2>
                <button type="button" onClick={() => { setPlannerOpen(false); setFooter("survey"); }} aria-label="Close route planner">
                  <X size={16} />
                </button>
              </div>
              <p className="field-label">Which walk</p>
              <div className="segmented three flex gap-1">
                <Choice active={walkMode === "inspector"} onClick={() => setWalkMode("inspector")} label="Inspector" />
                <Choice active={walkMode === "farmer"} onClick={() => setWalkMode("farmer")} label="Farmer" />
                <Choice active={walkMode === "both"} onClick={() => setWalkMode("both")} label="Both" />
              </div>
              <p className="field-label">Start (WGS84 or UTM 35N)</p>
              <div className="coord-row">
                <label>
                  Lon / X
                  <input inputMode="decimal" value={startLon} onChange={(e) => setStartLon(e.target.value)} onBlur={() => showParsedStart()} aria-label="Start longitude or UTM easting" />
                </label>
                <label>
                  Lat / Y
                  <input inputMode="decimal" value={startLat} onChange={(e) => setStartLat(e.target.value)} onBlur={() => showParsedStart()} aria-label="Start latitude or UTM northing" />
                </label>
              </div>
              <div className="segmented three flex gap-1">
                <Choice
                  active={startLon === String(OFFICIAL_START[0]) && startLat === String(OFFICIAL_START[1])}
                  onClick={applyOfficialStart}
                  label="Official"
                />
                <Choice
                  active={startLon === PRETEST_UTM.x && startLat === PRETEST_UTM.y}
                  onClick={applyPretest}
                  label="Pre-test"
                />
                <Choice active={pickStart} onClick={() => setPickStart((v) => !v)} label={pickStart ? "Tap map…" : "Pin on map"} />
              </div>
              <p className="field-label">Speed</p>
              <div className="speed-row flex gap-1">
                {SPEEDS.map((n) => (
                  <SpeedChip key={n} n={n} active={speed === n} onClick={() => setSpeed(n)} />
                ))}
              </div>
              {walkUi === "playing" ? (
                <button type="button" className="build-button flex items-center justify-center gap-3" onClick={pauseWalk}>
                  <Pause size={18} strokeWidth={1.8} />
                  Pause
                </button>
              ) : (
                <button type="button" className="build-button flex items-center justify-center gap-3" onClick={resumeWalk}>
                  <Play size={18} strokeWidth={1.8} />
                  {walkUi === "paused" ? "Resume" : "Play"}
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {status === "loading" && (
          <motion.div
            className="load-pill"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <span className="status-dot" />
            Loading Sireț3 layers
          </motion.div>
        )}
      </AnimatePresence>

      <header className="topbar absolute inset-x-0 top-0 z-30 flex items-center">
        <div className="brand-bar">
          <strong className="brand-name">Sireț3</strong>
          <span className="brand-meta">{sampleMode ? "Sample" : "Demetra"}</span>
        </div>
        <div className="top-actions flex items-center">
          <span className="desktop-only">
            <IconAction
              label={fullscreen ? "Exit full screen" : "Enter full screen"}
              onClick={toggleFullscreen}
              pressed={fullscreen}
            >
              {fullscreen ? <Minimize2 size={16} strokeWidth={1.75} /> : <Expand size={16} strokeWidth={1.75} />}
            </IconAction>
          </span>
          <IconAction label="Reload layers" onClick={() => setReload((n) => n + 1)}>
            <RefreshCw size={16} strokeWidth={1.75} />
          </IconAction>
        </div>
      </header>

      {panelsVisible && (
        <>
          {(layersOpen || sheet === "layers") && (
          <section className={`panel layers-panel ${sheet === "layers" ? "is-sheet-open" : ""}`} aria-labelledby="layers-heading">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="panel-title flex items-center gap-2">
              <h2 id="layers-heading">Layers</h2>
              <button
                type="button"
                className="collapse-button"
                onClick={() => {
                  setLayersOpen(false);
                  setSheet(null);
                }}
                aria-label="Close layers"
              >
                <X size={18} />
              </button>
            </div>
            <div className="layer-list">
              {LAYER_DEFS.map(({ key, label, swatch }) => (
                <label key={key} className={`layer-row flex items-center ${layers[key] ? "" : "layer-disabled"}`}>
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() => toggleLayer(key)}
                    className="layer-native-check"
                  />
                  <span className={`layer-check layer-check-${key}`} aria-hidden="true">
                    {layers[key] && <Check size={14} strokeWidth={2.7} />}
                  </span>
                  <span className="layer-label">{label}</span>
                  <span className={`swatch swatch-${swatch}`} aria-hidden="true" />
                </label>
              ))}
            </div>
          </section>
          )}

          <div className="right-panel-stack">
            <section className={`panel summary-panel ${sheet === "summary" ? "is-sheet-open" : ""}`} aria-labelledby="summary-heading">
              <div className="sheet-handle" aria-hidden="true" />
              <div className="panel-title flex items-center gap-2">
                <h2 id="summary-heading">Survey</h2>
                <button type="button" className="collapse-button sheet-close" onClick={() => setSheet(null)} aria-label="Close summary">
                  <X size={18} />
                </button>
              </div>
              <div className="stat-list">
                <Detail label="Blocks" value={blocks} />
                <Detail label="Rows" value={rows} />
                <Detail label="Canopy" value={fmtHa(totals.canopyHa)} />
                <Detail label="Inter-row" value={fmtHa(totals.interrowHa)} />
                <Detail label="Row length" value={fmtM(totals.rowLengthM)} />
                <Detail label="Walk" value={routeKm} />
              </div>
            </section>

            {selected && (!plannerOpen || sheet === "selected") && (
              <section className={`panel selected-panel ${sheet === "selected" ? "is-sheet-open" : ""}`} aria-labelledby="selected-heading">
                <div className="sheet-handle" aria-hidden="true" />
                <div className="panel-title flex items-center gap-2">
                  <h2 id="selected-heading">{selected?.title || "Selected"}</h2>
                  <button type="button" className="collapse-button sheet-close" onClick={() => setSheet(null)} aria-label="Close feature">
                    <X size={18} />
                  </button>
                </div>
                {selected ? (
                  <div className="detail-list">
                    {selected.vineyardId && <Detail label="Vineyard ID" value={selected.vineyardId} />}
                    {selected.rowId && <Detail label="Row ID" value={selected.rowId} />}
                    {selected.lengthM != null && !Number.isNaN(selected.lengthM) && (
                      <Detail label="Length" value={`${selected.lengthM.toFixed(1)} m`} />
                    )}
                    {selected.structure && (
                      <Detail
                        label="Structure"
                        value={selected.structure === "disrupted" ? "Disrupted" : selected.structure}
                        alert={selected.structure === "disrupted"}
                      />
                    )}
                    {!selectedRows && <Detail label="Details" value={selected.note || "No attributes available"} />}
                  </div>
                ) : (
                  <p className="empty-selection">Click an annotation to inspect it.</p>
                )}
              </section>
            )}
          </div>

          {(plannerOpen || sheet === "planner") && (
            <section className={`panel route-planner ${sheet === "planner" ? "is-sheet-open" : ""}`} id="route-planner" aria-labelledby="planner-heading">
              <div className="sheet-handle" aria-hidden="true" />
              <div className="panel-title planner-title flex items-center gap-2">
                <h2 id="planner-heading">Route</h2>
                <button
                  type="button"
                  className="collapse-button"
                  onClick={() => {
                    setPlannerOpen(false);
                    setSheet(null);
                  }}
                  aria-label="Close route planner"
                >
                  <Minus size={20} />
                </button>
              </div>
              <div className="planner-body">
                <p className="field-label">Which walk</p>
                <div className="segmented three flex gap-1">
                  <Choice active={walkMode === "inspector"} onClick={() => setWalkMode("inspector")} label="Inspector" />
                  <Choice active={walkMode === "farmer"} onClick={() => setWalkMode("farmer")} label="Farmer" />
                  <Choice active={walkMode === "both"} onClick={() => setWalkMode("both")} label="Both" />
                </div>
                <p className="field-label">Start (WGS84 or UTM 35N)</p>
                <div className="coord-row">
                  <label>
                    Lon / X
                    <input
                      inputMode="decimal"
                      value={startLon}
                      onChange={(e) => setStartLon(e.target.value)}
                      onBlur={() => showParsedStart()}
                      aria-label="Start longitude or UTM easting"
                    />
                  </label>
                  <label>
                    Lat / Y
                    <input
                      inputMode="decimal"
                      value={startLat}
                      onChange={(e) => setStartLat(e.target.value)}
                      onBlur={() => showParsedStart()}
                      aria-label="Start latitude or UTM northing"
                    />
                  </label>
                </div>
                <div className="segmented three flex gap-1">
                  <Choice
                    active={startLon === String(OFFICIAL_START[0]) && startLat === String(OFFICIAL_START[1])}
                    onClick={applyOfficialStart}
                    label="Official"
                  />
                  <Choice
                    active={startLon === PRETEST_UTM.x && startLat === PRETEST_UTM.y}
                    onClick={applyPretest}
                    label="Pre-test"
                  />
                  <Choice
                    active={pickStart}
                    onClick={() => setPickStart((v) => !v)}
                    label={pickStart ? "Tap map…" : "Pin on map"}
                  />
                </div>
                <p className="field-label">Speed</p>
                <div className="speed-row flex gap-1">
                  {SPEEDS.map((n) => (
                    <SpeedChip key={n} n={n} active={speed === n} onClick={() => setSpeed(n)} />
                  ))}
                </div>
                <label className="walk-progress">
                  <span>Along walk</span>
                  <input
                    className="walk-progress-input"
                    type="range"
                    min={0}
                    max={1000}
                    defaultValue={0}
                    onInput={(e) => {
                      if (!walkRef.current && !armWalk()) return;
                      seekWalk(Number((e.target as HTMLInputElement).value) / 1000);
                    }}
                    aria-label="Walk progress"
                  />
                </label>
                {walkUi === "playing" ? (
                  <button type="button" className="build-button flex items-center justify-center gap-3" onClick={pauseWalk}>
                    <Pause size={20} strokeWidth={1.8} />
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    className="build-button flex items-center justify-center gap-3"
                    onClick={resumeWalk}
                  >
                    <Play size={20} strokeWidth={1.8} />
                    {walkUi === "paused" ? "Resume" : "Play"}
                  </button>
                )}
                <p className="route-caption">
                  Inspector {fmtM(totals.inspectorM)} <span>·</span> Farmer {fmtM(totals.farmerM)}
                </p>
              </div>
            </section>
          )}

          <button
            type="button"
            className="plan-button flex items-center justify-center gap-3"
            aria-expanded={footer === "plan"}
            aria-controls="route-planner"
            onClick={() => {
              const open = footer !== "plan";
              setPlannerOpen(open);
              setFooter(open ? "plan" : "survey");
              if (open) setSelected(null);
            }}
          >
            Route
          </button>
          <div className="scale" aria-label={`Map scale approximately ${scaleM} metres`}>
            <div className="scale-labels">
              <span>0</span>
              <span>{Math.round(scaleM / 4)}</span>
              <span>{Math.round(scaleM / 2)}</span>
              <span>{scaleM} m</span>
            </div>
            <div className="scale-rule">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {sheet && (
          <motion.button
            type="button"
            className="sheet-backdrop"
            aria-label="Close panel"
            onClick={() => setSheet(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {walkUi !== "idle" && (
          <motion.div
            className="playback-bar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <button
              type="button"
              className="playback-play"
              onClick={walkUi === "playing" ? pauseWalk : resumeWalk}
              aria-label={walkUi === "playing" ? "Pause walk" : "Resume walk"}
            >
              {walkUi === "playing" ? <Pause size={18} strokeWidth={2} /> : <Play size={18} strokeWidth={2} />}
            </button>
            <input
              className="walk-progress-input"
              type="range"
              min={0}
              max={1000}
              defaultValue={0}
              onInput={(e) => {
                if (!walkRef.current && !armWalk()) return;
                seekWalk(Number((e.target as HTMLInputElement).value) / 1000);
              }}
              aria-label="Walk progress"
            />
            <div className="speed-row playback-speeds">
              {SPEEDS.map((n) => (
                <SpeedChip key={n} n={n} active={speed === n} onClick={() => setSpeed(n)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="mobile-dock" aria-label="Map tools">
          <button
            type="button"
            className={sheet === "layers" ? "is-active" : ""}
            aria-pressed={sheet === "layers"}
            onClick={() => {
              setFooter((cur) => (cur === "layers" ? "survey" : "layers"));
              setSheet((cur) => (cur === "layers" ? null : "layers"));
            }}
          >
            <Layers3 size={20} strokeWidth={1.9} />
            Layers
          </button>
          <button
            type="button"
            className={sheet === "summary" ? "is-active" : ""}
            aria-pressed={sheet === "summary"}
            onClick={() => {
              setFooter("survey");
              setSheet((cur) => (cur === "summary" ? null : "summary"));
            }}
          >
            <BarChart3 size={20} strokeWidth={1.9} />
            Survey
          </button>
          <button
            type="button"
            className={sheet === "planner" ? "is-active" : ""}
            aria-pressed={sheet === "planner"}
            onClick={() => {
              const open = sheet !== "planner";
              setPlannerOpen(open);
              setFooter(open ? "plan" : "survey");
              setSheet((cur) => (cur === "planner" ? null : "planner"));
            }}
          >
            <Route size={20} strokeWidth={1.9} />
            Route
          </button>
          <button type="button" onClick={recenter}>
            <Navigation size={20} strokeWidth={1.9} />
            Start
          </button>
      </nav>

      <AnimatePresence>
        {(message || error) && (
          <motion.div
            className="toast"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <span>{error || message}</span>
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setError("");
              }}
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!panelsVisible && <div className="hidden-panels-hint">Panels hidden · use the top control to restore</div>}
    </main>
  );
}

function IconAction({
  label,
  children,
  onClick,
  pressed,
  title,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="round-action grid place-items-center"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={title || label}
    >
      {children}
    </button>
  );
}

function SpeedChip({ n, active, onClick }: { n: WalkSpeed; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`speed-chip ${active ? "is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {n}×
    </button>
  );
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`choice ${active ? "is-active" : ""}`} onClick={onClick} aria-pressed={active}>
      {label}
    </button>
  );
}

function Detail({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="detail-row flex items-center justify-between gap-2">
      <span>{label}</span>
      <strong className={alert ? "alert-value" : ""}>
        {value}
        {alert && <span className="alert-symbol">▲</span>}
      </strong>
    </div>
  );
}
