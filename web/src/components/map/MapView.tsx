"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MlMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { VIEW_2D, VIEW_3D, WORKER_URL } from "@/lib/map/config";
import { addDataLayers, baseStyle } from "@/lib/map/style";
import type { LayerName, LonLat } from "@/lib/data/types";

export type MapViewProps = {
  center: LonLat;
  zoom: number;
  /** "3d" enables terrain and tilts the camera (spec: pitch 58°, bearing −10°). */
  mode?: "2d" | "3d";
  exaggeration?: number;
  dark?: boolean;
  /** Add the survey data layers (plants, rows, gaps, …). */
  dataLayers?: boolean | Partial<Record<LayerName, boolean>>;
  interactive?: boolean;
  className?: string;
  /** Accessible name for the map region. */
  label: string;
  onReady?: (map: MlMap) => void;
};

/**
 * Shared MapLibre canvas: base style, optional terrain + data layers. Screens add their own layers,
 * handlers and controls in `onReady`. Client-only; load it with next/dynamic `{ ssr: false }`.
 */
export function MapView({
  center,
  zoom,
  mode = "3d",
  exaggeration = VIEW_3D.exaggeration,
  dark = true,
  dataLayers = true,
  interactive = true,
  className,
  label,
  onReady,
}: MapViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !host.current) return;
      maplibre.setWorkerUrl(WORKER_URL());
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const view = mode === "3d" ? VIEW_3D : VIEW_2D;
      map = new maplibre.Map({
        container: host.current,
        style: baseStyle({ dark }),
        center,
        zoom,
        pitch: view.pitch,
        bearing: view.bearing,
        maxPitch: 75,
        interactive,
        attributionControl: { compact: true },
        fadeDuration: reduce ? 0 : 300,
      });
      mapRef.current = map;
      map.on("error", (e) => {
        if (String(e?.error?.message ?? "").includes("WebGL")) setFailed(true);
      });
      map.on("load", () => {
        if (!map || cancelled) return;
        if (mode === "3d") map.setTerrain({ source: "terrain", exaggeration });
        if (dataLayers) addDataLayers(map, dataLayers === true ? {} : dataLayers);
        readyRef.current?.(map);
      });
    })().catch(() => setFailed(true));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once; screens drive camera/terrain changes through the map instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    return (
      <div role="img" aria-label={label} className={className}>
        <p className="p-6 text-mist">The map needs WebGL. Open Dementra in a current Chrome, Safari or Firefox.</p>
      </div>
    );
  }
  return <div ref={host} role="region" aria-label={label} className={className} />;
}

/** Toggle 2D/3D on an existing map. */
export function setMode(map: MlMap, mode: "2d" | "3d", exaggeration: number = VIEW_3D.exaggeration): void {
  const view = mode === "3d" ? VIEW_3D : VIEW_2D;
  map.setTerrain(mode === "3d" ? { source: "terrain", exaggeration } : null);
  map.easeTo({ pitch: view.pitch, bearing: view.bearing, duration: 900 });
}
