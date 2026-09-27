"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Check,
  Expand,
  Leaf,
  Layers3,
  Minimize2,
  Minus,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Route,
  Rows3,
  ScanLine,
  X,
} from "lucide-react";
import { parseStart, toLonLatCollection, utm35nToLonLat } from "@/lib/geo";
import { createLayerVisibility } from "@/lib/layer-visibility";
import Brand from "./Brand";
import { readRoute } from "@/lib/route-path";
import { cameraAnimation } from "@/lib/motion";
import { RoutePlaybackControls, useRoutePlayback, type WalkRoutes } from "./route-playback";
import { BrandIntro, useBrandIntro, usePresence, PanelHeader, PanelBody, PanelCollapse } from "./workspace-chrome";

const SIRET3_XYZ =
  "https://api.imagery.hotosm.org/raster/collections/openaerialmap/items/683060c4025981aa411253c8/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=visual";

/** Official start in WGS84 (data/challenge/02_route/start.geojson). */
const OFFICIAL_START: [number, number] = [28.7073776, 47.1230335];
const PRETEST_UTM = { x: "629663.8", y: "5220195.3" };
const PRETEST_WGS: [number, number] = utm35nToLonLat(629663.8, 5220195.3);

type Status = "loading" | "ready" | "error" | "empty";
type WalkMode = "inspector" | "farmer" | "both";
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
  { key: "vineyard", label: "Canopies", swatch: "canopy", legend: "Canopy" },
  { key: "row", label: "Rows", swatch: "row", legend: "Row" },
  { key: "interrow", label: "Inter-row Areas", swatch: "interrow", legend: "Inter-row" },
  { key: "waste", label: "Waste", swatch: "waste", legend: "Waste" },
  { key: "inspection", label: "Inspection Points", swatch: "inspection", legend: "Inspection" },
  { key: "inspector", label: "Inspector walk", swatch: "inspector", legend: "Inspector" },
  { key: "farmer", label: "Farmer walk", swatch: "farmer", legend: "Farmer" },
  { key: "forbidden", label: "Forbidden", swatch: "forbidden", legend: "Forbidden" },
  { key: "passage", label: "Passages", swatch: "passage", legend: "Passage" },
];

type Fc = { type?: string; features?: Array<{ properties?: Record<string, unknown>; geometry?: { type?: string; coordinates?: unknown } }> };

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
    inspection: true,
    inspector: true,
    farmer: true,
  });
  const [totals, setTotals] = useState<Totals>({ vineyard: 0, row: 0, waste: 0 });
  const [sampleMode, setSampleMode] = useState(true);
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const summaryBeforePlanner = useRef(false);
  const [walkMode, setWalkMode] = useState<WalkMode>("both");
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const [mapZoom, setMapZoom] = useState(16.6);
  const [startPin, setStartPin] = useState<"official" | "pretest">("official");


  const [playbackMap, setPlaybackMap] = useState<import("maplibre-gl").Map | null>(null);
  const [walkRoutes, setWalkRoutes] = useState<WalkRoutes | null>(null);
  const player = useRoutePlayback({ map: playbackMap, routes: walkRoutes, mode: walkMode, visible: { inspector: layers.inspector, farmer: layers.farmer }, onMessage: setMessage });
  const cancelRouteAnimation = player.cancelAnimation;
  const intro = useBrandIntro();
  const [pickSnapshot, setPickSnapshot] = useState<{ role: "inspector" | "farmer"; kind: "start" | "end" } | null>(null);
  const pickPresence = usePresence(intro.ready && Boolean(player.picking));
  const pickDisplay = player.picking || pickSnapshot;
  const [collapsedPanels, setCollapsedPanels] = useState({ layers: false, summary: false, selected: false, planner: false, legend: false });
  const [noticeSnapshot, setNoticeSnapshot] = useState("");
  const visibility = useRef<ReturnType<typeof createLayerVisibility> | null>(null);
  const latestLayers = useRef(layers);
  const startPinRef = useRef(startPin);
  const panelsActive = intro.ready && panelsVisible && !player.picking;
  const headerPresence = usePresence(intro.ready);
  const panelsPresence = usePresence(panelsActive);
  const selectedPresence = usePresence(panelsActive && !plannerOpen);
  const plannerPresence = usePresence(panelsActive && plannerOpen);
  const notice = error || message;
  const toastPresence = usePresence(intro.ready && Boolean(notice));
  const hintPresence = usePresence(intro.ready && !panelsVisible);

  function togglePanel(panel: keyof typeof collapsedPanels) {
    setCollapsedPanels((current) => ({ ...current, [panel]: !current[panel] }));
  }

  function togglePlanner() {
    if (plannerOpen) {
      setCollapsedPanels((current) => ({ ...current, summary: summaryBeforePlanner.current }));
    } else {
      summaryBeforePlanner.current = collapsedPanels.summary;
      setCollapsedPanels((current) => ({ ...current, summary: true, planner: false }));
    }
    setPlannerOpen((value) => !value);
  }

  useEffect(() => {
    if (notice) setNoticeSnapshot(notice);
  }, [notice]);

  useEffect(() => {
    if (player.picking) setPickSnapshot(player.picking);
  }, [player.picking]);

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
        maplibre.config.WORKER_URL = `${window.location.origin}/maplibre-gl-worker.mjs`;

        const [packed, sample, inspectorRaw, farmerRaw, csvText] = await Promise.all([
          fetchJson("/layers/layers.geojson"),
          fetchJson("/layers/sample.geojson"),
          fetchJson("/layers/route.geojson"),
          fetchJson("/layers/route-farmer.geojson"),
          fetch("/layers/measurements.csv").then((r) => (r.ok ? r.text() : "")),
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

        const currentMap = map = new maplibre.Map({
          container: mapEl.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap",
              },
              siret3: {
                type: "raster",
                tiles: [SIRET3_XYZ],
                tileSize: 256,
                attribution: "Sireț3 © 3DATA COLLECT / OIN, CC BY 4.0",
              },
            },
            layers: [
              { id: "osm", type: "raster", source: "osm", paint: { "raster-brightness-max": 0.32, "raster-saturation": -0.85 } },
              { id: "siret3", type: "raster", source: "siret3", paint: { "raster-opacity": 0.92 } },
            ],
          },
          center: OFFICIAL_START,
          zoom: 16.6,
          attributionControl: {},
        });
        mapRef.current = currentMap;
        currentMap.on("error", (ev) => {
          const msg = ev.error?.message || "";
          if (msg.includes("Worker") || msg.includes("actors") || msg.includes("siret3") || msg.includes("Failed to fetch")) return;
        });
        currentMap.on("zoom", () => setMapZoom(currentMap.getZoom()));

        currentMap.on("load", () => {
          if (cancelled) return;
          currentMap.resize();
          currentMap.addSource("sample", { type: "geojson", data: sampleData as GeoJSON.GeoJSON });
          currentMap.addSource("inspector", { type: "geojson", data: inspector as GeoJSON.GeoJSON });
          currentMap.addSource("farmer", { type: "geojson", data: farmer as GeoJSON.GeoJSON });
          currentMap.addSource("start", {
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
          currentMap.addSource("query-pin", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });

          currentMap.addLayer({
            id: "vineyard-fill",
            type: "fill",
            source: "sample",
            filter: [
              "all",
              ["==", ["get", "kind"], "vineyard"],
              ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]],
            ],
            paint: { "fill-color": "#0b9b4e", "fill-opacity": 0.2, "fill-outline-color": "#20b768" },
          });
          currentMap.addLayer({
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
          currentMap.addLayer({
            id: "interrow-fill",
            type: "fill",
            source: "sample",
            filter: ["==", ["get", "kind"], "interrow_area"],
            paint: { "fill-color": "#bfc8c5", "fill-opacity": 0.22 },
          });
          currentMap.addLayer({
            id: "passage-fill",
            type: "fill",
            source: "sample",
            filter: ["==", ["get", "kind"], "passage"],
            paint: { "fill-color": "#bbdf36", "fill-opacity": 0.08, "fill-outline-color": "#bbdf36" },
          });
          currentMap.addLayer({
            id: "forbidden-fill",
            type: "fill",
            source: "sample",
            filter: ["==", ["get", "kind"], "forbidden"],
            paint: { "fill-color": "#f35a43", "fill-opacity": 0.22 },
          });
          currentMap.addLayer({
            id: "waste-fill",
            type: "fill",
            source: "sample",
            filter: ["==", ["get", "kind"], "waste"],
            paint: { "fill-color": "#e85b43", "fill-opacity": 0.2, "fill-outline-color": "#e85b43" },
          });
          currentMap.addLayer({
            id: "row-line",
            type: "line",
            source: "sample",
            filter: ["==", ["get", "kind"], "row"],
            paint: { "line-color": "#d6cb30", "line-width": 2.2, "line-dasharray": [3, 2.5] },
          });
          currentMap.addLayer({
            id: "inspector-line",
            type: "line",
            source: "inspector",
            filter: ["==", ["get", "kind"], "route"],
            paint: { "line-color": "#438bff", "line-width": 3.2, "line-dasharray": [1.6, 1] },
          });
          currentMap.addLayer({
            id: "farmer-line",
            type: "line",
            source: "farmer",
            filter: ["==", ["get", "kind"], "route"],
            paint: { "line-color": "#f05d55", "line-width": 2.8, "line-dasharray": [0.7, 1.3] },
          });
          currentMap.addLayer({
            id: "inspection-pt",
            type: "circle",
            source: "sample",
            filter: ["==", ["get", "kind"], "inspection"],
            paint: { "circle-color": "#ff9829", "circle-radius": 4.5, "circle-stroke-width": 1, "circle-stroke-color": "#fff" },
          });
          currentMap.addLayer({
            id: "start-pt",
            type: "circle",
            source: "start",
            paint: { "circle-color": "#438bff", "circle-radius": 7, "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
          });
          currentMap.addLayer({
            id: "query-pin",
            type: "circle",
            source: "query-pin",
            paint: { "circle-color": "#2f7a38", "circle-radius": 8, "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
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
            currentMap.on("mouseenter", id, () => {
              if (!currentMap.getCanvas().dataset.picking) currentMap.getCanvas().style.cursor = "pointer";
            });
            currentMap.on("mouseleave", id, () => {
              currentMap.getCanvas().style.cursor = currentMap.getCanvas().dataset.picking ? "crosshair" : "";
            });
            currentMap.on("click", id, (e) => {
              if (currentMap.getCanvas().dataset.picking) return;
              const f = e.features?.[0];
              if (!f) return;
              setSelected(selectedFromClick(id, (f.properties || {}) as Record<string, unknown>));
            });
          }

          visibility.current = createLayerVisibility(currentMap, LAYER_MAP);
          visibility.current.set(latestLayers.current, false);
          setWalkRoutes({ inspector: readRoute(inspector.features), farmer: readRoute(farmer.features) });
          setPlaybackMap(currentMap);
          setStatus(feats.length ? "ready" : "empty");
          if (startPinRef.current === "pretest") {
            const pin = currentMap.getSource("query-pin") as { setData: (data: GeoJSON.FeatureCollection) => void } | undefined;
            pin?.setData({
              type: "FeatureCollection",
              features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: PRETEST_WGS } }],
            });
          }
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
      ro?.disconnect();
      cancelRouteAnimation();
      setPlaybackMap(null);
      visibility.current?.dispose();
      visibility.current = null;
      mapRef.current = undefined;
      map?.remove();
    };
  }, [reload, cancelRouteAnimation]);

  useEffect(() => {
    latestLayers.current = layers;
    visibility.current?.set(layers);
  }, [layers]);

  useEffect(() => {
    startPinRef.current = startPin;
  }, [startPin]);

  function toggleLayer(key: LayerKey) {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setQueryPin(pt: [number, number] | null) {
    const src = mapRef.current?.getSource("query-pin") as { setData: (data: GeoJSON.FeatureCollection) => void } | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: pt
        ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: pt } }]
        : [],
    });
  }

  function flyToPin(pt: [number, number]) {
    mapRef.current?.flyTo({ center: pt, zoom: 17.4, ...cameraAnimation() });
    setQueryPin(pt);
  }

  function applyOfficialStart() {
    setStartPin("official");
    flyToPin(OFFICIAL_START);
    setMessage("Official start 47.1230335 N, 28.7073776 E");
  }

  function applyPretest() {
    const pt = parseStart(PRETEST_UTM.x, PRETEST_UTM.y);
    if (!pt) return;
    setStartPin("pretest");
    flyToPin(pt);
    setMessage(`Pre-test ${PRETEST_WGS[1].toFixed(7)} N, ${PRETEST_WGS[0].toFixed(7)} E`);
  }

  function recenter() {
    const pin = startPin === "pretest" ? PRETEST_WGS : player.startPoint || OFFICIAL_START;
    flyToPin(pin);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await workspace.current?.requestFullscreen();
    } catch {
      setMessage("Full screen is unavailable in this browser.");
    }
  }

  function revealWalk() {
    setLayers((prev) => ({ ...prev, inspector: walkMode !== "farmer", farmer: walkMode !== "inspector" }));
  }

  function showWalk() {
    revealWalk();
    const inspectorM = player.lengths.inspector != null ? String(player.lengths.inspector) : totals.inspectorM;
    const farmerM = player.lengths.farmer != null ? String(player.lengths.farmer) : totals.farmerM;
    if (walkMode === "inspector") {
      setMessage(`Inspector walk ${fmtM(inspectorM)} · gaps + waste`);
    } else if (walkMode === "farmer") {
      setMessage(`Farmer walk ${fmtM(farmerM)} · waste only`);
    } else {
      setMessage(`Both walks · inspector ${fmtM(inspectorM)} · farmer ${fmtM(farmerM)}`);
    }
    player.fit();
  }

  const blocks = totals.nBlocks ?? String(totals.vineyard || "—");
  const rows = totals.nRows ?? String(totals.row || "—");
  const routeKm = fmtKmFromM(String(player.lengths[player.primary] ?? (walkMode === "farmer" ? totals.farmerM : totals.inspectorM) ?? ""));
  const selectedRows = selected?.kind === "row";
  const scaleM = Math.round(200 / Math.max(0.4, mapZoom / 16.6));

  return (
    <main className="workspace" ref={workspace}>
      <div className={`app-stage ${intro.revealing ? "is-revealing" : ""}`} aria-hidden={!intro.ready} inert={!intro.ready}>
        <div ref={mapEl} className="map-surface" aria-label="Sireț3 vineyard map" />
        {status === "loading" && <div className="loading-map" role="status"><span>Loading Sireț3 layers…</span></div>}

        {headerPresence.rendered && <header className="topbar absolute inset-x-0 top-0 z-30 flex items-center justify-between" data-motion={headerPresence.motion}>
          <Brand />
          <div className="top-actions flex items-center gap-3">
            <IconAction label={panelsVisible ? "Hide panels" : "Show panels"} onClick={() => setPanelsVisible((value) => !value)} pressed={!panelsVisible}>
              {panelsVisible ? <PanelLeftClose size={23} strokeWidth={1.8} /> : <PanelLeftOpen size={23} strokeWidth={1.8} />}
            </IconAction>
            <IconAction label={fullscreen ? "Exit full screen" : "Enter full screen"} onClick={toggleFullscreen} pressed={fullscreen}>
              {fullscreen ? <Minimize2 size={22} strokeWidth={1.9} /> : <Expand size={22} strokeWidth={1.9} />}
            </IconAction>
            <button type="button" className="upload-button flex items-center justify-center gap-2" aria-label="Reload layers" onClick={() => setReload((n) => n + 1)}>
              <RefreshCw size={20} strokeWidth={1.9} /><span>Reload Layers</span>
            </button>
          </div>
        </header>}

        {panelsPresence.rendered && <>
          <section className="identity-block" aria-label="Vineyard status" data-motion={panelsPresence.motion} aria-hidden={!panelsActive} inert={!panelsActive}>
            <div className={`status-pill flex items-center gap-2 ${status === "loading" ? "is-processing" : ""} ${status === "error" ? "status-error" : ""}`} role="status">
              <span className="status-dot" />
              {status === "loading" ? "Processing…" : status === "error" ? "Map error" : status === "empty" ? "No features" : "Analysis Complete"}
            </div>
            <h1>Sireț3 <span className="vineyard-name-label">Vineyard</span></h1>
            <div className="identity-meta flex items-center gap-2"><p>Aerial inspection <span>·</span> EPSG:32635</p><div className={sampleMode ? "demo-tag" : "demo-tag is-live"}>{sampleMode ? "SAMPLE" : "MARCAJ"}</div></div>
          </section>

          <section className="panel layers-panel" aria-labelledby="layers-heading" data-motion={panelsPresence.motion} data-collapsed={collapsedPanels.layers} aria-hidden={!panelsActive} inert={!panelsActive}>
            <PanelHeader icon={<Layers3 size={22} fill="white" strokeWidth={1.6} />} title="Layers" headingId="layers-heading" label="layers" collapsed={collapsedPanels.layers} controls="layers-content" onToggle={() => togglePanel("layers")} />
            <PanelBody id="layers-content" collapsed={collapsedPanels.layers} className="layer-list">
              {LAYER_DEFS.map(({ key, label, swatch }) => <label key={key} className={`layer-row flex items-center ${layers[key] ? "" : "layer-disabled"}`}>
                <input type="checkbox" checked={layers[key]} onChange={() => toggleLayer(key)} className="layer-native-check" />
                <span className={`layer-check layer-check-${key}`} data-checked={layers[key]} aria-hidden="true"><Check size={14} strokeWidth={2.7} /></span>
                <span className="layer-label">{label}</span><span className={`swatch swatch-${swatch}`} aria-hidden="true" />
              </label>)}
            </PanelBody>
          </section>

          <aside className="right-panels" aria-label="Vineyard panels" aria-hidden={!panelsActive} inert={!panelsActive}>
            <section className="panel summary-panel" aria-labelledby="summary-heading" data-motion={panelsPresence.motion} data-collapsed={collapsedPanels.summary}>
              <PanelHeader icon={<BarChart3 size={22} fill="white" strokeWidth={1.5} />} title="Vineyard Summary" headingId="summary-heading" label="vineyard summary" collapsed={collapsedPanels.summary} controls="summary-content" onToggle={() => togglePanel("summary")} />
              <PanelBody id="summary-content" collapsed={collapsedPanels.summary} className="summary-grid grid grid-cols-2 gap-2">
                <SummaryMetric icon={<Layers3 />} label="Blocks" value={blocks} />
                <SummaryMetric icon={<Rows3 />} label="Rows" value={rows} />
                <SummaryMetric icon={<Leaf />} label="Canopy Area" value={fmtHa(totals.canopyHa)} />
                <SummaryMetric icon={<ScanLine />} label="Inter-row Area" value={fmtHa(totals.interrowHa)} />
                <SummaryMetric icon={<Route />} label="Total Row Length" value={fmtKmFromM(totals.rowLengthM)} />
                <SummaryMetric icon={<Route />} label="Route" value={routeKm} />
              </PanelBody>
            </section>

            <div className="panel-switch" data-current={plannerOpen ? "planner" : "selected"}>
            {selectedPresence.rendered && <section className="panel selected-panel" aria-labelledby="selected-heading" data-motion={selectedPresence.motion} data-collapsed={collapsedPanels.selected} aria-hidden={!(panelsActive && !plannerOpen)} inert={!(panelsActive && !plannerOpen)}>
              <PanelHeader icon={<Leaf size={22} fill="white" strokeWidth={1.3} />} title={selected?.title || "Selected Feature"} headingId="selected-heading" label="selected feature" collapsed={collapsedPanels.selected} controls="selected-content" onToggle={() => togglePanel("selected")} />
              <PanelBody id="selected-content" collapsed={collapsedPanels.selected}>
                {selected ? <div className="detail-list">
                  {selected.vineyardId && <Detail label="Vineyard ID" value={selected.vineyardId} />}
                  {selected.rowId && <Detail label="Row ID" value={selected.rowId} />}
                  {selected.lengthM != null && !Number.isNaN(selected.lengthM) && <Detail label="Length" value={`${selected.lengthM.toFixed(1)} m`} />}
                  {selected.structure && <Detail label="Structure" value={selected.structure === "disrupted" ? "Disrupted" : selected.structure} alert={selected.structure === "disrupted"} />}
                  {!selectedRows && <Detail label="Details" value={selected.note || "No attributes available"} />}
                </div> : <p className="empty-selection">Click an annotation to inspect it.</p>}
              </PanelBody>
            </section>}

          {plannerPresence.rendered && <section className="panel route-planner" id="route-planner" aria-labelledby="planner-heading" data-motion={plannerPresence.motion} data-collapsed={collapsedPanels.planner} aria-hidden={!(panelsActive && plannerOpen)} inert={!(panelsActive && plannerOpen)}>
            <PanelHeader icon={<Route size={22} strokeWidth={1.6} />} title="Route Planner" headingId="planner-heading" label="route planner" collapsed={collapsedPanels.planner} controls="planner-content" onToggle={() => togglePanel("planner")} />
            <PanelBody id="planner-content" collapsed={collapsedPanels.planner} className="planner-body">
              <p className="field-label">Which walk</p>
              <div className="segmented three flex gap-1">
                <Choice active={walkMode === "inspector"} onClick={() => setWalkMode("inspector")} label="Inspector" />
                <Choice active={walkMode === "farmer"} onClick={() => setWalkMode("farmer")} label="Farmer" />
                <Choice active={walkMode === "both"} onClick={() => setWalkMode("both")} label="Both" />
              </div>
              <p className="field-label">Start pin</p>
              <div className="segmented flex gap-1">
                <Choice active={startPin === "official"} onClick={applyOfficialStart} label="Official" />
                <Choice active={startPin === "pretest"} onClick={applyPretest} label="Pre-test" />
              </div>
              <RoutePlaybackControls player={player} reveal={revealWalk} />
              <button type="button" className="build-button flex items-center justify-center gap-3" onClick={showWalk} disabled={status === "loading" || status === "error"}>
                <Route size={24} strokeWidth={1.8} />Show walk
              </button>
              <p className="route-caption">Inspector {fmtM(player.lengths.inspector != null ? String(player.lengths.inspector) : totals.inspectorM)} <span>·</span> Farmer {fmtM(player.lengths.farmer != null ? String(player.lengths.farmer) : totals.farmerM)}</p>
            </PanelBody>
          </section>}
            </div>
          </aside>

          <div className="map-controls flex flex-col gap-1" aria-label="Map controls" data-motion={panelsPresence.motion} aria-hidden={!panelsActive} inert={!panelsActive}>
            <IconAction label="Zoom in" onClick={() => mapRef.current?.zoomIn(cameraAnimation())}><Plus size={25} /></IconAction>
            <IconAction label="Zoom out" onClick={() => mapRef.current?.zoomOut(cameraAnimation())}><Minus size={25} /></IconAction>
            <IconAction label="Go to start point" title="Go to start point" onClick={recenter}><Navigation size={22} fill="white" /></IconAction>
          </div>

          <section className="legend panel flex items-center" aria-label="Map legend" data-motion={panelsPresence.motion} data-collapsed={collapsedPanels.legend} aria-hidden={!panelsActive} inert={!panelsActive}>
            <span className="legend-collapsed-label" aria-hidden={!collapsedPanels.legend}>Legend</span>
            <div className="legend-content flex items-center" id="legend-content" aria-hidden={collapsedPanels.legend} inert={collapsedPanels.legend}>
              {LAYER_DEFS.map((layer) => <div key={layer.key} className="legend-item flex items-center gap-2" data-visible={layers[layer.key]} aria-hidden={!layers[layer.key]}>
                <span className={`swatch swatch-${layer.swatch}`} aria-hidden="true" /><span>{layer.legend}</span>
              </div>)}
            </div>
            <PanelCollapse label="map legend" collapsed={collapsedPanels.legend} controls="legend-content" onClick={() => togglePanel("legend")} />
          </section>
          <button type="button" className="plan-button flex items-center justify-center gap-3" data-motion={panelsPresence.motion} aria-hidden={!panelsActive} inert={!panelsActive} aria-expanded={plannerOpen} aria-controls="route-planner" onClick={togglePlanner}>
            <Route size={24} strokeWidth={1.8} />Plan Route
          </button>
          <div className="scale" aria-label={`Map scale approximately ${scaleM} metres`} data-motion={panelsPresence.motion} aria-hidden={!panelsActive}>
            <div className="scale-labels"><span>0</span><span>{Math.round(scaleM / 4)}</span><span>{Math.round(scaleM / 2)}</span><span>{scaleM} m</span></div>
            <div className="scale-rule"><i /><i /><i /><i /></div>
          </div>
        </>}

        {pickPresence.rendered && pickDisplay && <div className="route-pick-banner" role="status" data-motion={pickPresence.motion} aria-hidden={!player.picking} inert={!player.picking}><span>Click the {pickDisplay.role} walk to choose its {pickDisplay.kind === "start" ? "start" : "finish"} point</span><button type="button" onClick={player.cancelPick}>Cancel</button></div>}
        {toastPresence.rendered && <div className="toast" role="status" aria-live="polite" data-motion={toastPresence.motion} aria-hidden={!notice} inert={!notice}>
          <span>{notice || noticeSnapshot}</span>
          <button type="button" onClick={() => { setMessage(""); setError(""); }} aria-label="Dismiss message"><X size={16} /></button>
        </div>}
        {hintPresence.rendered && <div className="hidden-panels-hint" data-motion={hintPresence.motion} aria-hidden={panelsVisible}>Panels hidden · use the top control to restore</div>}
      </div>
      <BrandIntro intro={intro} />
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

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`choice flex items-center justify-center gap-2 ${active ? "is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="choice-radio" />
      <span>{label}</span>
    </button>
  );
}

function SummaryMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  const parts = value.match(/^(.*?)\s+(ha|km|m)$/);
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <div>
        <span className="metric-label">{label}</span>
        <strong aria-label={value}>{parts ? <><span className="metric-number">{parts[1]}</span>{" "}<span className="metric-unit">{parts[2]}</span></> : <span className="metric-number">{value}</span>}</strong>
      </div>
    </div>
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
