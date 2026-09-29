"use client";

import { useEffect, useState } from "react";
import { formatDuration, formatInt } from "@/lib/data/format";
import type { LonLat } from "@/lib/data/types";
import { walkSentence } from "@/lib/walks/coverage";
import { formatWalkKm } from "@/lib/walks/format";
import { wholeWalkTrackNote } from "@/lib/walks/gpx";
import { taskHeading, taskNote, type WalkRole } from "@/lib/walks/tasks";
import { Button } from "@/components/ui/Button";
import { saveWalkGpx } from "./save-gpx";

const ROUTE_NOTE =
  "Starts and ends at the farm-track junction in the north-west corner. Stays on inter-rows and tracks, never inside forbidden zones.";

type WaypointTask = {
  id: string;
  kind: "gap" | "waste";
  block: string | null;
  row: number | null;
  gap_m: number | null;
  at: LonLat;
};

type Toast = { kind: "ok" } | { kind: "link"; link: string } | null;

export function WalkSummary({
  walk,
  block,
  lengthM,
  stops,
  visited,
  total,
  coordinates,
  tasks,
}: {
  walk: WalkRole;
  block: string | null;
  lengthM: number;
  stops: number;
  visited: number | null;
  total: number | null;
  coordinates: LonLat[];
  tasks: WaypointTask[];
}) {
  const [toast, setToast] = useState<Toast>(null);
  const name = walk === "farmer" ? "Farmer walk" : "Inspector walk";
  const stats = [
    { label: "Distance", value: formatWalkKm(lengthM) },
    { label: "On foot", value: formatDuration(lengthM) },
    ...(stops > 0 ? [{ label: "Stops", value: formatInt(stops) }] : []),
  ];

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function sendToPhone() {
    const link = window.location.href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(link);
      setToast({ kind: "ok" });
    } catch {
      setToast({ kind: "link", link });
    }
  }

  const trackNote = wholeWalkTrackNote(block);

  function downloadGpx() {
    saveWalkGpx({
      walk,
      block,
      name,
      coordinates,
      waypoints: tasks.map((task) => ({
        at: task.at,
        name: taskHeading(task),
        description: taskNote(task.kind, "list"),
        type: task.kind,
      })),
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-card bg-paper p-[22px]">
      <div
        className="grid gap-3 tabular-nums"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      >
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="text-[13px] text-ink-muted">{stat.label}</div>
            <div className="font-display text-[28px] leading-none font-bold">{stat.value}</div>
          </div>
        ))}
      </div>
      <p className="m-0 text-sm leading-normal text-ink-muted">
        {walkSentence({ role: walk, lengthM, stops, visited, total })}
      </p>
      <p className="m-0 text-sm leading-normal text-ink-muted">{ROUTE_NOTE}</p>
      {trackNote ? <p className="m-0 text-sm leading-normal text-ink-muted">{trackNote}</p> : null}
      <div className="flex gap-2.5">
        <Button className="flex-1" onClick={sendToPhone}>
          Send to phone
        </Button>
        <Button variant="outline" className="flex-1" onClick={downloadGpx}>
          Download GPX
        </Button>
      </div>
      {toast ? (
        <p role="status" aria-live="polite" className="m-0 text-sm break-all text-moss">
          {toast.kind === "ok" ? "Link copied" : `Copy this link: ${toast.link}`}
        </p>
      ) : null}
    </section>
  );
}
