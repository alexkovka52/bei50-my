"use client";

import { ChevronLeft, LocateFixed, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rail } from "@/components/shell/Rail";
import type { BBox, LonLat, Task } from "@/lib/data/types";
import { createRoutePath } from "@/lib/route-path";
import { wholeWalkTrackNote } from "@/lib/walks/gpx";
import { filterTasks, nextTaskAhead, parseBlockParam, parseWalkParam, taskHeading, taskNote, walkHref, type WalkRole } from "@/lib/walks/tasks";
import { withRouteDistance } from "@/lib/walks/position";
import { Button } from "@/components/ui/Button";
import { readDone, writeDone } from "./done-store";
import { PhoneSheet } from "./PhoneSheet";
import { PlaybackBar } from "./PlaybackBar";
import { saveWalkGpx } from "./save-gpx";
import { TaskList } from "./TaskList";
import { useWalkPlayback } from "./use-playback";
import { WalkSummary } from "./WalkSummary";
import { WalkTabs } from "./WalkTabs";
import type { MapFocus } from "./WalkMap";

const WalkMap = dynamic(() => import("./WalkMap").then((mod) => mod.WalkMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-forest" role="img" aria-label="Loading the walk map" />,
});

export type StudioWalk = {
  coordinates: LonLat[];
  lengthM: number;
  stops: number;
  targetsVisited: number | null;
  targetsTotal: number | null;
};

function writeWalkUrl(nextWalk: WalkRole, nextBlock: string | null) {
  const url = new URL(window.location.href);
  if (nextWalk === "farmer") url.searchParams.set("walk", "farmer");
  else url.searchParams.delete("walk");
  if (nextBlock) url.searchParams.set("block", nextBlock);
  else url.searchParams.delete("block");
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
    window.history.pushState(null, "", next);
  }
}

export function WalkStudio({
  initialWalk,
  initialBlock,
  blockBBox,
  start,
  center,
  walks,
  tasks,
}: {
  initialWalk: WalkRole;
  initialBlock: string | null;
  blockBBox: BBox | null;
  start: LonLat;
  center: LonLat;
  walks: Record<WalkRole, StudioWalk>;
  tasks: Task[];
}) {
  const [walk, setWalk] = useState(initialWalk);
  const [block, setBlock] = useState(initialBlock);
  const bundle = walks[walk];
  const path = useMemo(() => createRoutePath(bundle.coordinates, bundle.lengthM), [bundle.coordinates, bundle.lengthM]);
  const playback = useWalkPlayback(path.lengthM);
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);
  const [tasksOpen, setTasksOpen] = useState(false);
  const closeTasksRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setWalk(initialWalk);
    setBlock(initialBlock);
  }, [initialWalk, initialBlock]);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setWalk(parseWalkParam(params.get("walk") ?? undefined));
      setBlock(parseBlockParam(params.get("block") ?? undefined));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const resetPlayback = playback.reset;
  useEffect(() => {
    resetPlayback();
    setSelectedId(null);
    setSkipped(new Set());
    setTasksOpen(false);
  }, [walk, resetPlayback]);

  useEffect(() => {
    if (!tasksOpen) return;
    closeTasksRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTasksOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tasksOpen]);

  const located = useMemo(() => withRouteDistance(path, tasks), [path, tasks]);

  useEffect(() => {
    setDone(readDone(located.map((task) => task.id)));
  }, [located]);

  const scoped = useMemo(() => filterTasks(located, { walk, block, kind: "all" }), [located, walk, block]);
  const excluded = useMemo(() => {
    const ids = new Set(done);
    for (const id of skipped) ids.add(id);
    return ids;
  }, [done, skipped]);
  const ahead = useMemo(
    () => nextTaskAhead(scoped, playback.distanceM, path.lengthM, excluded),
    [scoped, playback.distanceM, path.lengthM, excluded],
  );

  const toggleDone = useCallback((id: string, value: boolean) => {
    setDone((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
    writeDone(id, value);
  }, []);

  const selectTask = useCallback(
    (task: Task) => {
      playback.setFollow(false);
      setSelectedId(task.id);
      setFocus({ token: Date.now(), at: task.at });
    },
    [playback],
  );

  const releaseFollow = useCallback(() => playback.setFollow(false), [playback]);

  const checkStop = useCallback(
    (id: string) => {
      toggleDone(id, true);
    },
    [toggleDone],
  );

  const skipStop = useCallback((id: string) => {
    setSkipped((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const selectWalk = useCallback(
    (next: WalkRole) => {
      setWalk(next);
      writeWalkUrl(next, block);
    },
    [block],
  );

  const mapLabel = walk === "farmer" ? "Farmer walk on the map" : "Inspector walk on the map";
  const nextStop = ahead
    ? { id: ahead.id, kind: ahead.kind, heading: taskHeading(ahead), note: taskNote(ahead.kind, "next") }
    : null;
  const trackNote = wholeWalkTrackNote(block);
  const walkName = walk === "farmer" ? "Farmer walk" : "Inspector walk";

  function downloadGpx() {
    saveWalkGpx({
      walk,
      block,
      name: walkName,
      coordinates: bundle.coordinates,
      waypoints: scoped.map((task) => ({
        at: task.at,
        name: taskHeading(task),
        description: taskNote(task.kind, "list"),
        type: task.kind,
      })),
    });
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-dew text-forest">
      <div className="hidden h-full shrink-0 min-[481px]:flex">
        <Rail />
      </div>
      <main
        id="main"
        tabIndex={-1}
        className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col min-[481px]:pt-6 min-[481px]:pr-8 min-[481px]:pb-8 min-[481px]:pl-2 min-[1024px]:flex-row min-[1024px]:gap-[22px]"
      >
        <h1 className="sr-only min-[481px]:hidden">Walks</h1>
        <aside className="hidden min-h-0 w-full shrink-0 flex-col gap-[18px] overflow-y-auto min-[481px]:flex min-[481px]:max-h-[52%] min-[1024px]:h-full min-[1024px]:max-h-none min-[1024px]:w-[420px]">
          <div className="flex items-center justify-between gap-3">
            <h1 className="m-0 font-display text-[40px] leading-none font-bold tracking-[-1px]">Walks</h1>
            <WalkTabs walk={walk} block={block} onSelect={selectWalk} idPrefix="walk-tab" panelId="walk-panel" />
          </div>
          <div id="walk-panel" role="tabpanel" aria-labelledby={`walk-tab-${walk}`} className="flex flex-col gap-[18px]">
            <WalkSummary
              walk={walk}
              block={block}
              lengthM={path.lengthM}
              stops={bundle.stops}
              visited={bundle.targetsVisited}
              total={bundle.targetsTotal}
              coordinates={bundle.coordinates}
              tasks={scoped}
            />
            <TaskList
              tasks={scoped}
              done={done}
              onToggle={toggleDone}
              onSelect={selectTask}
              selectedId={selectedId}
              block={block}
              clearHref={walkHref(walk, null)}
              showGaps={walk !== "farmer"}
            />
          </div>
        </aside>
        <section
          aria-label="Walk on the map"
          className="relative min-h-[240px] min-w-0 flex-1 overflow-hidden bg-forest max-[480px]:absolute max-[480px]:inset-0 max-[480px]:min-h-0 min-[481px]:rounded-[32px]"
        >
          <WalkMap
            path={path}
            center={center}
            start={start}
            walk={walk}
            block={block}
            blockBBox={blockBBox}
            distanceM={playback.distanceM}
            follow={playback.follow}
            focus={focus}
            recenterToken={recenterToken}
            onReleaseFollow={releaseFollow}
            label={mapLabel}
          />
          <div className="absolute inset-x-4 top-[52px] z-10 flex items-center justify-between min-[481px]:hidden">
            <Link
              href="/"
              aria-label="Back to overview"
              className="inline-flex size-11 items-center justify-center rounded-full bg-[rgba(15,42,29,0.78)] text-dew no-underline"
            >
              <ChevronLeft aria-hidden="true" size={20} strokeWidth={2} />
            </Link>
            <div className="rounded-pill bg-budbreak px-3.5 py-2 text-[13px] font-semibold text-forest">{walkName}</div>
            <button
              type="button"
              aria-label="Recenter on me"
              onClick={() => {
                playback.setFollow(true);
                setRecenterToken((token) => token + 1);
              }}
              className="inline-flex size-11 items-center justify-center rounded-full border-0 bg-[rgba(15,42,29,0.78)] text-budbreak"
            >
              <LocateFixed aria-hidden="true" size={18} strokeWidth={1.8} />
            </button>
          </div>
          <div className="absolute inset-x-5 bottom-5 z-10 hidden min-[481px]:block">
            <PlaybackBar
              lengthM={path.lengthM}
              distanceM={playback.distanceM}
              playing={playback.playing}
              speed={playback.speed}
              follow={playback.follow}
              onToggle={playback.toggle}
              onSeek={playback.seek}
              onSpeed={playback.setSpeed}
              onFollow={playback.setFollow}
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 min-[481px]:hidden">
            <PhoneSheet
              walk={walk}
              block={block}
              lengthM={path.lengthM}
              distanceM={playback.distanceM}
              playing={playback.playing}
              taskCount={scoped.length}
              next={nextStop}
              onSelectWalk={selectWalk}
              onSeek={playback.seek}
              onToggle={playback.toggle}
              onCheck={checkStop}
              onSkip={skipStop}
              onOpenTasks={() => setTasksOpen(true)}
            />
          </div>
        </section>
      </main>
      {tasksOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="phone-tasks-title"
          className="fixed inset-0 z-30 flex flex-col bg-dew min-[481px]:hidden"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-4">
            <h2 id="phone-tasks-title" className="m-0 text-lg font-semibold">
              Tasks
            </h2>
            <button
              ref={closeTasksRef}
              type="button"
              aria-label="Close tasks"
              onClick={() => setTasksOpen(false)}
              className="inline-flex size-11 items-center justify-center rounded-full border-0 bg-paper text-forest"
            >
              <X aria-hidden="true" size={18} strokeWidth={1.8} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-8" role="region" aria-label="Task list">
            {trackNote ? <p className="mt-0 mb-4 text-sm text-ink-muted">{trackNote}</p> : null}
            <TaskList
              tasks={scoped}
              done={done}
              onToggle={toggleDone}
              onSelect={selectTask}
              selectedId={selectedId}
              block={block}
              clearHref={walkHref(walk, null)}
              showGaps={walk !== "farmer"}
            />
            <Button className="mt-4 w-full" onClick={downloadGpx}>
              Download GPX
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
