"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import type { Map as MlMap } from "maplibre-gl";
import { ForestPlaceholder } from "@/components/overview/ForestPlaceholder";
import type { BBox, LonLat } from "@/lib/data/types";
import { setSelectedBlock } from "@/lib/map/style";

const MapView = dynamic(() => import("@/components/map/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => <ForestPlaceholder />,
});

export function PreviewMap({
  id,
  center,
  bbox,
  zoom,
}: {
  id: string | null;
  center: LonLat;
  bbox: BBox;
  zoom: number;
}) {
  const [west, south, east, north] = bbox;
  const onReady = useCallback(
    (map: MlMap) => {
      if (id) setSelectedBlock(map, id);
      if (!(east > west) || !(north > south)) return;
      const frame = () => {
        const canvas = map.getContainer();
        if (canvas.clientWidth < 40 || canvas.clientHeight < 40) return;
        const camera = map.cameraForBounds(
          [
            [west, south],
            [east, north],
          ],
          { padding: { top: 150, bottom: 120, left: 28, right: 28 }, maxZoom: 19 },
        );
        if (!camera || camera.zoom == null) return;
        map.jumpTo({ center: camera.center, zoom: camera.zoom, pitch: 58, bearing: -10 });
      };
      map.resize();
      frame();
      map.on("resize", frame);
    },
    [id, west, south, east, north],
  );

  return (
    <MapView
      center={center}
      zoom={zoom}
      mode="3d"
      interactive={false}
      dark
      dataLayers={{
        blocks: true,
        gaps: true,
        waste: true,
        plants: false,
        rows: false,
        interrows: false,
        passages: false,
        forbidden: false,
      }}
      label={id ? `Sireț3 in 3D, framed on block ${id}` : "Sireț3 in 3D"}
      onReady={onReady}
      className="absolute inset-0 h-full w-full"
    />
  );
}
