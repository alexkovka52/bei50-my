"use client";

import type { Map as MlMap } from "maplibre-gl";
import type { LonLat } from "@/lib/data/types";
import { MapCanvas } from "./map-canvas";
import { focusRing, glass, glassButton } from "./styles";

type MinimapProps = {
  center: LonLat;
  onReady: (map: MlMap) => void;
};

export function Minimap({ center, onReady }: MinimapProps) {
  return (
    <div className="absolute bottom-5 left-5 z-10 hidden h-32 w-[188px] overflow-hidden rounded-[18px] border-2 border-[rgba(227,238,212,0.3)] min-[1025px]:block">
      <MapCanvas
        center={center}
        zoom={13}
        mode="2d"
        dark
        interactive={false}
        dataLayers={false}
        label="Overview of the whole vineyard"
        onReady={onReady}
        className="h-full w-full [&_.maplibregl-ctrl]:hidden"
      />
    </div>
  );
}

export function MapLegend({ scale }: { scale: string }) {
  return (
    <div
      className={`absolute bottom-[22px] left-1/2 z-10 hidden -translate-x-1/2 items-center gap-4 rounded-pill px-[18px] py-2.5 text-[13px] min-[1025px]:flex ${glass}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-[9px] rounded-full bg-gap" />
        Gap of 5 m or more
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-[9px] rounded-[2px] bg-waste" />
        Waste
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-[9px] w-3 rounded-[2px] border-[1.5px] border-budbreak" />
        Selected
      </span>
      <span className="text-mist">{scale}</span>
    </div>
  );
}

type MapControlsProps = {
  bearing: number;
  bearingLabel: string;
  onResetNorth: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function MapControls({ bearing, bearingLabel, onResetNorth, onZoomIn, onZoomOut }: MapControlsProps) {
  return (
    <div className="absolute right-5 bottom-5 z-10 hidden flex-col gap-2 min-[1025px]:flex">
      <button type="button" className={glassButton} aria-label={`Reset north, ${bearingLabel}`} onClick={onResetNorth}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${bearing}deg)` }}>
          <polygon points="12 2 19 21 12 17 5 21 12 2" fill="#D6F26B" />
        </svg>
      </button>
      <div className={`flex flex-col overflow-hidden rounded-[22px] ${glass}`}>
        <button type="button" className={`size-11 text-xl text-dew ${focusRing}`} aria-label="Zoom in" onClick={onZoomIn}>
          +
        </button>
        <button type="button" className={`size-11 text-xl text-dew ${focusRing}`} aria-label="Zoom out" onClick={onZoomOut}>
          −
        </button>
      </div>
    </div>
  );
}

export function viewportRing(bounds: { getWest: () => number; getSouth: () => number; getEast: () => number; getNorth: () => number }) {
  const west = bounds.getWest();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  };
}
