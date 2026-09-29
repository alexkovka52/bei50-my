"use client";

import type { LonLat } from "@/lib/data/types";
import { buildGpx, gpxFileName, type GpxWaypoint } from "@/lib/walks/gpx";
import type { WalkRole } from "@/lib/walks/tasks";

export function saveWalkGpx(options: {
  walk: WalkRole;
  block: string | null;
  name: string;
  coordinates: LonLat[];
  waypoints: GpxWaypoint[];
}) {
  const xml = buildGpx({ name: options.name, coordinates: options.coordinates, waypoints: options.waypoints });
  const url = URL.createObjectURL(new Blob([xml], { type: "application/gpx+xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = gpxFileName(options.walk, options.block);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
