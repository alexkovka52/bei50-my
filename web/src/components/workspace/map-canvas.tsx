"use client";

import dynamic from "next/dynamic";

export const MapCanvas = dynamic(() => import("@/components/map/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-forest" aria-hidden="true" />,
});
