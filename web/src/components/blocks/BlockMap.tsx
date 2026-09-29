"use client";

import type { Map as MlMap } from "maplibre-gl";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import type { Block } from "@/lib/data/types";
import { setSelectedBlock } from "@/lib/map/style";
import { cn } from "@/lib/utils";
import styles from "./BlockMap.module.css";

const MapView = dynamic(() => import("@/components/map/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-dew" />,
});

const LAYERS = {
  blocks: true,
  gaps: true,
  waste: true,
  plants: false,
  rows: false,
  interrows: false,
  passages: false,
  forbidden: false,
} as const;

function frameBlock(map: MlMap, block: Block) {
  setSelectedBlock(map, block.id);
  const [west, south, east, north] = block.bbox;
  const finite = [west, south, east, north].every((value) => Number.isFinite(value));
  if (!finite || west === east || south === north) {
    map.jumpTo({ center: block.centroid, zoom: 16, pitch: 0, bearing: 0 });
    return;
  }
  map.fitBounds(
    [
      [Math.min(west, east), Math.min(south, north)],
      [Math.max(west, east), Math.max(south, north)],
    ],
    { padding: 28, animate: false, pitch: 0, bearing: 0 },
  );
}

type BlockMapProps = {
  block: Block;
  className?: string;
  /** Short map in the blocks list. Keeps the attribution to a single line. */
  preview?: boolean;
};

export function BlockMap({ block, className, preview = false }: BlockMapProps) {
  const mapRef = useRef<MlMap | null>(null);
  const blockRef = useRef(block);
  blockRef.current = block;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.resize();
    frameBlock(map, block);
  }, [block]);

  return (
    <div className={cn("bg-dew", styles.frame, preview && styles.preview, className)}>
      <MapView
        center={block.centroid}
        zoom={16}
        mode="2d"
        dark={false}
        interactive={false}
        dataLayers={LAYERS}
        label={`Aerial map of block ${block.id}`}
        className="h-full w-full"
        onReady={(map) => {
          mapRef.current = map;
          frameBlock(map, blockRef.current);
          const observer = new ResizeObserver(() => {
            map.resize();
            frameBlock(map, blockRef.current);
          });
          observer.observe(map.getContainer());
          map.once("remove", () => observer.disconnect());
        }}
      />
    </div>
  );
}
