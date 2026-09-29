"use client";

import type { FilterSpecification, GeoJSONSource, Map as MlMap } from "maplibre-gl";
import { Marker } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapView } from "@/components/map/MapView";
import type { BBox, LonLat } from "@/lib/data/types";
import { setDataLayerVisible, setSelectedBlock } from "@/lib/map/style";
import { cameraAnimation } from "@/lib/motion";
import {
  boundsOf,
  lineFeatureCollection,
  pointFeatureCollection,
  positionAlongLine,
  sliceRoute,
} from "@/lib/walks/position";
import type { WalkRole } from "@/lib/walks/tasks";
import type { RoutePath } from "@/lib/route-path";

const REMAINING = "walk-remaining";
const WALKED = "walk-walked";
const POSITION = "walk-position";
const FOCUS = "walk-focus";

const EMPTY = { type: "FeatureCollection" as const, features: [] };

export type MapFocus = { token: number; at: LonLat };

function mapAlive(map: MlMap): boolean {
  try {
    return Boolean(map.getStyle());
  } catch {
    return false;
  }
}

function geoSource(map: MlMap, id: string): GeoJSONSource | null {
  const source = map.getSource(id);
  if (!source || source.type !== "geojson") return null;
  return source as GeoJSONSource;
}

function ensureLayers(map: MlMap) {
  if (map.getSource(REMAINING)) return;
  map.addSource(REMAINING, { type: "geojson", data: EMPTY });
  map.addSource(WALKED, { type: "geojson", data: EMPTY });
  map.addSource(POSITION, { type: "geojson", data: EMPTY });
  map.addSource(FOCUS, { type: "geojson", data: EMPTY });
  const before = map.getLayer("gaps-circle") ? "gaps-circle" : undefined;
  map.addLayer(
    {
      id: `${REMAINING}-line`,
      type: "line",
      source: REMAINING,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#E3EED4", "line-width": 2.5, "line-opacity": 0.95, "line-dasharray": [1.4, 1.6] },
    },
    before,
  );
  map.addLayer(
    {
      id: `${WALKED}-line`,
      type: "line",
      source: WALKED,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#D6F26B", "line-width": 4 },
    },
    before,
  );
  map.addLayer({
    id: `${POSITION}-halo`,
    type: "circle",
    source: POSITION,
    paint: { "circle-radius": 14, "circle-color": "#D6F26B", "circle-opacity": 0.35 },
  });
  map.addLayer({
    id: `${POSITION}-dot`,
    type: "circle",
    source: POSITION,
    paint: {
      "circle-radius": 7,
      "circle-color": "#D6F26B",
      "circle-stroke-color": "#0F2A1D",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: `${FOCUS}-ring`,
    type: "circle",
    source: FOCUS,
    paint: {
      "circle-radius": 12,
      "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": "#D6F26B",
      "circle-stroke-width": 3,
    },
  });
}

function pinElement(): HTMLDivElement {
  const pin = document.createElement("div");
  pin.style.cssText =
    "width:22px;height:22px;border-radius:999px;background:#0F2A1D;border:3px solid #D6F26B;box-sizing:border-box;";
  return pin;
}

function labelElement(): HTMLDivElement {
  const label = document.createElement("div");
  label.textContent = "Start and finish";
  label.style.cssText =
    "background:#0F2A1D;color:#E3EED4;font-size:12px;font-weight:600;line-height:1.2;border-radius:8px;padding:4px 8px;white-space:nowrap;font-family:Onest,system-ui,sans-serif;";
  return label;
}

function fitPadding(phone: boolean) {
  return phone
    ? { top: 108, right: 28, bottom: 360, left: 28 }
    : { top: 40, right: 40, bottom: 128, left: 40 };
}

function placeMapChrome(map: MlMap) {
  const root = map.getContainer();
  const phone = window.matchMedia("(max-width: 480px)").matches;
  // Logo and the attribution button sit above the playback bar, or the phone sheet.
  const lift = phone ? "translateY(-348px)" : "translateY(-132px)";
  for (const selector of [".maplibregl-ctrl-bottom-right", ".maplibregl-ctrl-bottom-left"]) {
    const node = root.querySelector(selector);
    if (node instanceof HTMLElement) node.style.transform = lift;
  }
  // Compact attribution still opens the credit line until the map is dragged.
  root.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
}

export function WalkMap({
  path,
  center,
  start,
  walk,
  block,
  blockBBox,
  distanceM,
  follow,
  focus,
  recenterToken,
  onReleaseFollow,
  label,
}: {
  path: RoutePath;
  center: LonLat;
  start: LonLat;
  walk: WalkRole;
  block: string | null;
  blockBBox: BBox | null;
  distanceM: number;
  follow: boolean;
  focus: MapFocus | null;
  recenterToken: number;
  onReleaseFollow: () => void;
  label: string;
}) {
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const seenRecenter = useRef(0);
  const layers = useMemo(
    () => ({
      forbidden: false,
      passages: false,
      interrows: false,
      blocks: true,
      plants: false,
      rows: false,
      waste: true,
      gaps: walk !== "farmer",
    }),
    [walk],
  );

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map || !mapAlive(map)) return;
    const parts = sliceRoute(path, distanceM);
    const at = positionAlongLine(path, distanceM);
    geoSource(map, REMAINING)?.setData(lineFeatureCollection(parts.remaining));
    geoSource(map, WALKED)?.setData(lineFeatureCollection(parts.walked));
    geoSource(map, POSITION)?.setData(pointFeatureCollection(at.point));
    if (follow) map.jumpTo({ center: at.point });
  }, [ready, path, distanceM, follow]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map || !mapAlive(map)) return;
    setDataLayerVisible(map, "gaps", walk !== "farmer");
    const filter: FilterSpecification | null = block ? ["==", ["get", "block"], block] : null;
    if (map.getLayer("gaps-circle")) map.setFilter("gaps-circle", filter);
    if (map.getLayer("waste-circle")) map.setFilter("waste-circle", filter);
    setSelectedBlock(map, block);
  }, [ready, walk, block]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map || !mapAlive(map)) return;
    const apply = () => {
      const current = mapRef.current;
      if (!current || !mapAlive(current)) return;
      const phone = window.matchMedia("(max-width: 480px)").matches;
      const camera = { padding: fitPadding(phone), duration: 0, maxZoom: 17 };
      if (blockBBox) current.fitBounds([[blockBBox[0], blockBBox[1]], [blockBBox[2], blockBBox[3]]], camera);
      else {
        const box = boundsOf(path.coordinates);
        if (box) current.fitBounds(box, camera);
      }
    };
    apply();
    placeMapChrome(map);
    const media = window.matchMedia("(max-width: 480px)");
    const onChange = () => {
      apply();
      placeMapChrome(map);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [ready, path, blockBBox]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map || !mapAlive(map)) return;
    const pin = new Marker({ element: pinElement(), anchor: "center" }).setLngLat(start).addTo(map);
    const labelMarker = new Marker({ element: labelElement(), anchor: "left", offset: [16, -18] }).setLngLat(start).addTo(map);
    return () => {
      pin.remove();
      labelMarker.remove();
    };
  }, [ready, start]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map || !mapAlive(map)) return;
    const release = () => onReleaseFollow();
    map.on("dragstart", release);
    return () => {
      map.off("dragstart", release);
    };
  }, [ready, onReleaseFollow]);

  useEffect(() => {
    if (!ready || !focus) return;
    const map = mapRef.current;
    if (!map || !mapAlive(map)) return;
    geoSource(map, FOCUS)?.setData(pointFeatureCollection(focus.at));
    map.flyTo({ center: focus.at, zoom: Math.max(map.getZoom(), 17.4), ...cameraAnimation() });
  }, [ready, focus]);

  useEffect(() => {
    if (!ready || recenterToken === 0 || seenRecenter.current === recenterToken) return;
    seenRecenter.current = recenterToken;
    const map = mapRef.current;
    if (!map || !mapAlive(map)) return;
    const { point } = positionAlongLine(path, distanceM);
    map.flyTo({ center: point, zoom: Math.max(map.getZoom(), 17), ...cameraAnimation() });
  }, [ready, recenterToken, path, distanceM]);

  return (
    <MapView
      center={center}
      zoom={15}
      mode="2d"
      dark
      interactive
      dataLayers={layers}
      label={label}
      className="h-full w-full"
      onReady={(map) => {
        mapRef.current = map;
        ensureLayers(map);
        setReady(true);
      }}
    />
  );
}
