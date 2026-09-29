"use client";

import type { GeoJSONSource, Map as MlMap, MapGeoJSONFeature } from "maplibre-gl";
import { Layers } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setDataLayerVisible, setSelectedBlock } from "@/lib/map/style";
import { cameraAnimation } from "@/lib/motion";
import type { LayerName, LargestGap } from "@/lib/data/types";
import {
  DEFAULT_LAYERS,
  LAYERS_COLLAPSED_KEY,
  LAYERS_STORAGE_KEY,
  cameraTargetFor,
  chipPosition,
  decodeLayers,
  encodeLayers,
  flownLabel,
  formatBearing,
  formatScale,
  gapHoverLabel,
  haversineMeters,
  highlightedBlock,
  layerVisibilityToMap,
  locationForSelection,
  mapSearchString,
  niceScaleMeters,
  parseMapQuery,
  parseMapSearch,
  resolveQuery,
  rowHoverLabel,
  rowNumberFromId,
  selectionForLocation,
  viewPadding,
  type GapSelection,
  type LayerKey,
  type LayerVisibility,
  type MapCatalog,
  type Selection,
} from "@/lib/workspace/map-state";
import { Inspector } from "./Inspector";
import { LayersPanel } from "./LayersPanel";
import { MapCanvas } from "./map-canvas";
import { MapControls, MapLegend, Minimap, viewportRing } from "./MapChrome";
import { MapToolbar } from "./MapToolbar";
import { cn } from "@/lib/utils";
import { glass, glassButton } from "./styles";

const WASTE_LAYER = "waste-circle";

type MapWorkspaceProps = {
  catalog: MapCatalog;
  initialSearch: string;
  /** Truthful inspector-walk sentence. The shared waste layer already draws the points. */
  walkNote: string;
};

export function MapWorkspace({ catalog, initialSearch, walkNote }: MapWorkspaceProps) {
  const initialLocation = useMemo(() => parseMapSearch(initialSearch), [initialSearch]);
  const blockIds = useMemo(() => catalog.blocks.map((block) => block.id), [catalog.blocks]);
  const rowIds = useMemo(() => catalog.rows.map((row) => row.id), [catalog.rows]);
  const blocksById = useMemo(() => new Map(catalog.blocks.map((block) => [block.id, block])), [catalog.blocks]);
  const rowsById = useMemo(() => new Map(catalog.rows.map((row) => [row.id, row])), [catalog.rows]);
  const wasteById = useMemo(() => new Map(catalog.waste.map((item) => [item.id, item])), [catalog.waste]);

  const [layers, setLayers] = useState<LayerVisibility>(() => initialLocation.layers ?? DEFAULT_LAYERS);
  const [selection, setSelection] = useState<Selection | null>(() => selectionForLocation(initialLocation, catalog.rows, blockIds));
  const [pinnedRow, setPinnedRow] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("3d");
  const [exaggeration, setExaggeration] = useState(1.5);
  const [opacity, setOpacity] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [bearing, setBearing] = useState(-10);
  const [scale, setScale] = useState("Scale");
  const [ready, setReady] = useState(false);

  const mapRef = useRef<MlMap | null>(null);
  const miniRef = useRef<MlMap | null>(null);
  const layersRef = useRef(layers);
  const selectionRef = useRef(selection);
  const modeRef = useRef(viewMode);
  const exaggerationRef = useRef(exaggeration);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetReturn = useRef<HTMLElement | null>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const hoveredBlock = useRef<string | null>(null);
  const flew = useRef(false);
  const alive = useRef(true);
  layersRef.current = layers;
  selectionRef.current = selection;
  modeRef.current = viewMode;
  exaggerationRef.current = exaggeration;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!initialLocation.layers) {
      const raw = window.localStorage.getItem(LAYERS_STORAGE_KEY);
      if (raw != null) {
        const stored = decodeLayers(raw);
        layersRef.current = stored;
        setLayers(stored);
        const map = mapRef.current;
        if (map?.isStyleLoaded()) applyLayers(map, stored);
      }
    }
    if (window.localStorage.getItem(LAYERS_COLLAPSED_KEY) === "1") setCollapsed(true);
    setReady(true);
  }, [initialLocation.layers]);

  useEffect(() => {
    if (!ready) return;
    const loc = locationForSelection(selection, selection?.kind === "block" ? pinnedRow : null);
    const next = mapSearchString({ layers, blockId: loc.blockId, rowId: loc.rowId });
    const current = window.location.search.replace(/^\?/, "");
    if (current !== next) {
      const path = next ? `${window.location.pathname}?${next}` : window.location.pathname;
      window.history.replaceState(null, "", path);
    }
    window.localStorage.setItem(LAYERS_STORAGE_KEY, encodeLayers(layers));
    window.localStorage.setItem(LAYERS_COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [ready, layers, selection, pinnedRow, collapsed]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applyLayers(map, layers);
  }, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("blocks-selected")) return;
    setSelectedBlock(map, highlightedBlock(selection));
  }, [selection]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (sheetRef.current && !sheetRef.current.hidden) {
        setSheetOpen(false);
        return;
      }
      if (!selectionRef.current) return;
      selectionRef.current = null;
      setSelection(null);
      setPinnedRow(null);
      const map = mapRef.current;
      if (map?.getLayer("blocks-selected")) setSelectedBlock(map, null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1025px)");
    function onChange() {
      if (media.matches) setSheetOpen(false);
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    sheetReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = sheetRef.current;
    root?.querySelector<HTMLElement>("button, input")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Tab" || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>("button, input, a[href]")];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    root?.addEventListener("keydown", onKey);
    return () => {
      root?.removeEventListener("keydown", onKey);
      sheetReturn.current?.focus();
    };
  }, [sheetOpen]);

  const moveCamera = useCallback((map: MlMap, next: Selection | null, immediate = false) => {
    const blockId = highlightedBlock(next);
    const block = blockId ? blocksById.get(blockId) : undefined;
    const target = cameraTargetFor(next, block?.bbox ?? null, catalog.bbox);
    const motion = immediate ? { duration: 0, easing: (t: number) => t } : cameraAnimation();
    const pitch = map.getPitch();
    const bearing = map.getBearing();
    if (target.kind === "point") {
      map.flyTo({
        center: target.at,
        zoom: Math.max(map.getZoom(), 17.5),
        offset: window.innerWidth > 1024 ? [-30, 0] : [0, -70],
        pitch,
        bearing,
        duration: motion.duration,
        easing: motion.easing,
      });
      return;
    }
    // Fit the box flat, then keep the current tilt. Fitting at pitch 58
    // zooms out until the vineyard is a few dozen pixels tall.
    const framed = map.cameraForBounds(target.bbox, {
      padding: viewPadding(window.innerWidth),
      maxZoom: 18,
      bearing,
      pitch: 0,
    });
    if (!framed?.center || framed.zoom == null) return;
    map.easeTo({
      center: framed.center,
      zoom: framed.zoom,
      pitch,
      bearing,
      duration: motion.duration,
      easing: motion.easing,
    });
  }, [blocksById, catalog.bbox]);

  useEffect(() => {
    function onPop() {
      const location = parseMapSearch(window.location.search);
      const stored = window.localStorage.getItem(LAYERS_STORAGE_KEY);
      const nextLayers = location.layers ?? (stored == null ? DEFAULT_LAYERS : decodeLayers(stored));
      layersRef.current = nextLayers;
      setLayers(nextLayers);
      const next = selectionForLocation(location, catalog.rows, blockIds);
      selectionRef.current = next;
      setSelection(next);
      setPinnedRow(null);
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;
      applyLayers(map, nextLayers);
      setSelectedBlock(map, highlightedBlock(next));
      moveCamera(map, next, true);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [blockIds, catalog.rows, moveCamera]);

  function choose(next: Selection | null, fly: boolean) {
    selectionRef.current = next;
    setSelection(next);
    setPinnedRow(null);
    const map = mapRef.current;
    if (map?.getLayer("blocks-selected")) setSelectedBlock(map, highlightedBlock(next));
    if (fly && map) moveCamera(map, next);
  }

  function syncRect() {
    const main = mapRef.current;
    const mini = miniRef.current;
    if (!main || !mini) return;
    const source = mini.getSource("view-rect");
    if (!source || !("setData" in source)) return;
    (source as GeoJSONSource).setData(viewportRing(main.getBounds()));
  }

  function publish(map: MlMap) {
    if (!alive.current) return;
    setBearing(map.getBearing());
    setScale(readScale(map));
    syncRect();
  }

  function onMainReady(map: MlMap) {
    mapRef.current = map;
    const canvas = map.getCanvas();
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", `${catalog.farm} map`);
    applyLayers(map, layersRef.current);
    bind(map);
    if (!flew.current) {
      flew.current = true;
      moveCamera(map, selectionRef.current, true);
      if (map.getLayer("blocks-selected")) setSelectedBlock(map, highlightedBlock(selectionRef.current));
    }
    publish(map);
  }

  function bind(map: MlMap) {
    let frame = 0;
    map.on("move", () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        publish(map);
      });
    });
    map.on("mousemove", (event) => onHover(map, event.point.x, event.point.y));
    map.on("mouseout", () => {
      showChip(null, 0, 0);
      map.getCanvas().style.cursor = "";
      if (hoveredBlock.current) {
        map.setFeatureState({ source: "blocks", id: hoveredBlock.current }, { hover: false });
        hoveredBlock.current = null;
      }
    });
    map.on("click", (event) => onClick(map, event));
  }

  function onClick(map: MlMap, event: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) {
    const present = ["gaps-circle", WASTE_LAYER, "blocks-fill"].filter((id) => map.getLayer(id));
    const hits = present.length ? map.queryRenderedFeatures([event.point.x, event.point.y], { layers: present }) : [];
    const gap = hits.find((hit) => hit.layer.id === "gaps-circle");
    if (gap) {
      const rowId = textProp(gap, "row_id");
      const gapM = Number(gap.properties?.gap_m);
      if (rowId && Number.isFinite(gapM)) {
        const next: GapSelection = {
          kind: "gap",
          id: textProp(gap, "id") || rowId,
          blockId: textProp(gap, "block"),
          rowId,
          gapM,
          at: [event.lngLat.lng, event.lngLat.lat],
        };
        choose(next, true);
        return;
      }
    }
    const waste = hits.find((hit) => hit.layer.id === WASTE_LAYER);
    if (waste) {
      const id = textProp(waste, "id");
      const known = wasteById.get(id);
      choose(
        {
          kind: "waste",
          id: id || "waste",
          blockId: textProp(waste, "block") || known?.block || null,
          at: known?.at ?? [event.lngLat.lng, event.lngLat.lat],
        },
        true,
      );
      return;
    }
    const block = hits.find((hit) => hit.layer.id === "blocks-fill");
    const blockId = block ? textProp(block, "id") || String(block.id ?? "") : "";
    if (blockId && blocksById.has(blockId)) {
      choose({ kind: "block", id: blockId }, true);
      return;
    }
    choose(null, false);
  }

  function onHover(map: MlMap, x: number, y: number) {
    const present = ["gaps-circle", "rows-line", "blocks-fill", WASTE_LAYER].filter((id) => map.getLayer(id));
    const hits = present.length ? map.queryRenderedFeatures([x, y], { layers: present }) : [];
    const gap = hits.find((hit) => hit.layer.id === "gaps-circle");
    const row = hits.find((hit) => hit.layer.id === "rows-line");
    const waste = hits.find((hit) => hit.layer.id === WASTE_LAYER);
    const block = hits.find((hit) => hit.layer.id === "blocks-fill");
    map.getCanvas().style.cursor = gap || row || waste || block ? "pointer" : "";
    const blockId = block ? textProp(block, "id") : "";
    if (hoveredBlock.current && hoveredBlock.current !== blockId) {
      map.setFeatureState({ source: "blocks", id: hoveredBlock.current }, { hover: false });
    }
    if (blockId && blockId !== hoveredBlock.current) {
      map.setFeatureState({ source: "blocks", id: blockId }, { hover: true });
    }
    hoveredBlock.current = blockId || null;
    const width = map.getContainer().clientWidth;
    const height = map.getContainer().clientHeight;
    if (gap) {
      const rowId = textProp(gap, "row_id");
      const blockName = textProp(gap, "block");
      const gapM = Number(gap.properties?.gap_m);
      const rowNumber = rowNumberFromId(rowId);
      if (rowId && rowNumber && blockName && Number.isFinite(gapM)) {
        const pos = chipPosition(x, y, width, height);
        showChip(gapHoverLabel(blockName, rowNumber, gapM), pos.left, pos.top);
        return;
      }
    }
    if (row) {
      const rowId = textProp(row, "id");
      if (rowId) {
        const structure = textProp(row, "structure");
        const known = structure === "regular" || structure === "disrupted" || structure === "unassessable" ? structure : null;
        const pos = chipPosition(x, y, width, height);
        showChip(rowHoverLabel(rowId, known), pos.left, pos.top);
        return;
      }
    }
    showChip(null, 0, 0);
  }

  function showChip(label: string | null, left: number, top: number) {
    const node = chipRef.current;
    if (!node) return;
    if (!label) {
      node.hidden = true;
      return;
    }
    node.hidden = false;
    node.textContent = label;
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  }

  function onMiniReady(mini: MlMap) {
    miniRef.current = mini;
    mini.fitBounds(catalog.bbox, { padding: 8, duration: 0, animate: false });
    const canvas = mini.getCanvas();
    canvas.tabIndex = -1;
    if (!mini.getSource("view-rect")) {
      mini.addSource("view-rect", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mini.addLayer({
        id: "view-rect-line",
        type: "line",
        source: "view-rect",
        paint: { "line-color": "#D6F26B", "line-width": 2 },
      });
    }
    syncRect();
  }

  function onSearch() {
    const found = resolveQuery(query, blockIds, rowIds);
    if (!found) {
      const parsed = parseMapQuery(query);
      if (!parsed) setError("Type a block such as V04, or a row such as V04 row 32.");
      else if (parsed.kind === "block") setError(`Block ${parsed.id} is not in this flight.`);
      else setError(`Row ${parsed.id} is not in this flight.`);
      return;
    }
    setError("");
    if (found.kind === "block") {
      choose({ kind: "block", id: found.id }, true);
      return;
    }
    const row = rowsById.get(found.id);
    if (!row) return;
    if (row.gap) {
      choose(
        { kind: "gap", id: row.gap.id, blockId: row.block, rowId: row.id, gapM: row.gap.gapM, at: row.gap.at },
        true,
      );
      return;
    }
    choose({ kind: "row", id: row.id, blockId: row.block, structure: row.structure, at: row.at }, true);
  }

  function onFlyGap(gap: LargestGap) {
    setPinnedRow(gap.row_id);
    const map = mapRef.current;
    if (!map) return;
    const motion = cameraAnimation();
    map.flyTo({
      center: gap.at,
      zoom: Math.max(map.getZoom(), 17.5),
      offset: window.innerWidth > 1024 ? [-30, 0] : [0, -70],
      pitch: map.getPitch(),
      bearing: map.getBearing(),
      duration: motion.duration,
      easing: motion.easing,
    });
  }

  async function onMode(next: "2d" | "3d") {
    setViewMode(next);
    modeRef.current = next;
    const map = mapRef.current;
    if (!map) return;
    const { setMode } = await import("@/components/map/MapView");
    setMode(map, next, exaggerationRef.current);
  }

  function onExaggeration(value: number) {
    setExaggeration(value);
    exaggerationRef.current = value;
    const map = mapRef.current;
    if (!map || modeRef.current !== "3d" || !map.getSource("terrain")) return;
    map.setTerrain({ source: "terrain", exaggeration: value });
  }

  function onOpacity(value: number) {
    setOpacity(value);
    const map = mapRef.current;
    if (map?.getLayer("ortho")) map.setPaintProperty("ortho", "raster-opacity", value);
  }

  function onToggle(key: LayerKey, on: boolean) {
    setLayers((current) => ({ ...current, [key]: on }));
  }

  const selectedBlock = selection ? blocksById.get(highlightedBlock(selection) ?? "") ?? null : null;

  return (
    <div className="map-workspace absolute inset-0">
      <style>{`.map-workspace .maplibregl-ctrl-logo,.map-workspace .maplibregl-ctrl-bottom-left{display:none !important}.map-workspace .map-close{display:none !important}@media (min-width:1025px){.map-workspace .map-close{display:inline-flex !important}}`}</style>
      <div className="absolute inset-0 z-0 [&_.maplibregl-ctrl-bottom-right]:!top-auto [&_.maplibregl-ctrl-bottom-right]:!right-4 [&_.maplibregl-ctrl-bottom-right]:!bottom-4 [&_.maplibregl-ctrl-bottom-right]:!left-auto min-[1025px]:[&_.maplibregl-ctrl-bottom-right]:!right-auto min-[1025px]:[&_.maplibregl-ctrl-bottom-right]:!bottom-3 min-[1025px]:[&_.maplibregl-ctrl-bottom-right]:!left-[13.75rem]">
        <MapCanvas
          center={catalog.center}
          zoom={13}
          mode="3d"
          exaggeration={1.5}
          dark
          dataLayers={layerVisibilityToMap(layers)}
          label={`${catalog.farm} map`}
          onReady={onMainReady}
          className="h-full w-full focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-budbreak"
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(180deg, #0F2A1D 0%, rgba(15,42,29,0.7) 16%, rgba(15,42,29,0) 40%, rgba(15,42,29,0) 80%, rgba(15,42,29,0.55) 100%)",
        }}
      />
      <MapToolbar
        farm={catalog.farm}
        flown={flownLabel(catalog.flownOn)}
        query={query}
        mode={viewMode}
        layersOpen={sheetOpen}
        onQuery={(value) => {
          setQuery(value);
          setError("");
        }}
        onSearch={onSearch}
        onMode={onMode}
        onOpenLayers={() => setSheetOpen(true)}
      />
      {error ? (
        <p role="alert" className="absolute top-[76px] left-1/2 z-30 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-pill bg-paper px-4 py-2 text-sm font-semibold text-forest">
          {error}
        </p>
      ) : null}
      <div className={cn("absolute top-[88px] left-5 z-20 hidden max-h-[calc(100dvh-7.5rem)] w-[288px] overflow-y-auto rounded-panel p-[18px]", glass, !collapsed && "min-[1025px]:block")}>
        <LayersPanel
          titleId="layers-dock-title"
          layers={layers}
          counts={catalog.counts}
          exaggeration={exaggeration}
          opacity={opacity}
          variant="dock"
          onToggle={onToggle}
          onExaggeration={onExaggeration}
          onOpacity={onOpacity}
          onClose={() => setCollapsed(true)}
          note={walkNote}
        />
      </div>
      {collapsed ? (
        <button type="button" className={cn(glassButton, "absolute top-[88px] left-5 z-20 hidden min-[1025px]:inline-flex")} aria-label="Show layers" onClick={() => setCollapsed(false)}>
          <Layers aria-hidden="true" size={18} strokeWidth={1.8} />
        </button>
      ) : null}
      {sheetOpen ? (
        <div className="fixed inset-0 z-40 min-[1025px]:hidden">
          <button type="button" aria-label="Close layers" className="absolute inset-0 bg-[rgba(15,42,29,0.45)]" onClick={() => setSheetOpen(false)} />
          <div
            ref={sheetRef}
            id="layers-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="layers-sheet-title"
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[26px] border border-[rgba(227,238,212,0.14)] bg-[rgba(15,42,29,0.92)] p-[18px] text-dew backdrop-blur-[16px]"
          >
            <LayersPanel
              titleId="layers-sheet-title"
              layers={layers}
              counts={catalog.counts}
              exaggeration={exaggeration}
              opacity={opacity}
              variant="sheet"
              onToggle={onToggle}
              onExaggeration={onExaggeration}
              onOpacity={onOpacity}
              onClose={() => setSheetOpen(false)}
              note={walkNote}
            />
          </div>
        </div>
      ) : null}
      {selection ? (
        <Inspector
          selection={selection}
          block={selectedBlock}
          onClose={() => choose(null, false)}
          onFlyGap={onFlyGap}
          onSelectBlock={(id) => choose({ kind: "block", id }, true)}
        />
      ) : null}
      <Minimap center={catalog.center} onReady={onMiniReady} />
      <MapLegend scale={scale} />
      <MapControls
        bearing={bearing}
        bearingLabel={formatBearing(bearing)}
        onResetNorth={() => {
          const map = mapRef.current;
          if (!map) return;
          map.easeTo({ bearing: 0, ...cameraAnimation() });
        }}
        onZoomIn={() => mapRef.current?.zoomIn({ duration: cameraAnimation().duration })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: cameraAnimation().duration })}
      />
      <div
        ref={chipRef}
        hidden
        aria-hidden="true"
        className="pointer-events-none absolute z-30 rounded-xl bg-dew px-3 py-2 text-[13px] font-semibold text-forest shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
      />
    </div>
  );
}

function textProp(feature: MapGeoJSONFeature, key: string): string {
  const value = feature.properties?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readScale(map: MlMap): string {
  const width = map.getContainer().clientWidth;
  const height = map.getContainer().clientHeight;
  if (!width || !height) return "Scale";
  const y = height / 2;
  const x = width / 2;
  const left = map.unproject([x - 40, y]);
  const right = map.unproject([x + 40, y]);
  const nice = niceScaleMeters(haversineMeters([left.lng, left.lat], [right.lng, right.lat]));
  return nice == null ? "Scale" : formatScale(nice);
}

function applyLayers(map: MlMap, layers: LayerVisibility) {
  const flags = layerVisibilityToMap(layers);
  for (const name of Object.keys(flags) as LayerName[]) setDataLayerVisible(map, name, flags[name]);
}
