"use client";

import { Pause, Play } from "lucide-react";
import { formatWalkKm, timeLeftLabel } from "@/lib/walks/format";
import { phoneNextStopCopy } from "@/lib/walks/phone-copy";
import { playbackFraction, playbackToggleLabel, remainingMetres } from "@/lib/walks/playback";
import type { WalkRole } from "@/lib/walks/tasks";
import { Button } from "@/components/ui/Button";
import { KindMark } from "./KindMark";
import { ProgressSlider } from "./ProgressSlider";
import { WalkTabs } from "./WalkTabs";

export type NextStop = {
  id: string;
  kind: "gap" | "waste";
  heading: string;
  note: string;
};

export function PhoneSheet({
  walk,
  block,
  lengthM,
  distanceM,
  playing,
  taskCount,
  next,
  onSelectWalk,
  onSeek,
  onToggle,
  onCheck,
  onSkip,
  onOpenTasks,
}: {
  walk: WalkRole;
  block: string | null;
  lengthM: number;
  distanceM: number;
  playing: boolean;
  taskCount: number;
  next: NextStop | null;
  onSelectWalk: (walk: WalkRole) => void;
  onSeek: (fraction: number) => void;
  onToggle: () => void;
  onCheck: (id: string) => void;
  onSkip: (id: string) => void;
  onOpenTasks: () => void;
}) {
  const fraction = playbackFraction(distanceM, lengthM);
  const valueText = `${formatWalkKm(distanceM, false)} of ${formatWalkKm(lengthM)}`;
  const copy = phoneNextStopCopy({
    nextHeading: next?.heading ?? null,
    nextNote: next?.note ?? null,
    taskCount,
  });
  return (
    <section aria-label="Walk progress" className="flex max-h-[68dvh] flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-dew px-5 pt-3.5 pb-7 text-forest">
      <div aria-hidden="true" className="mx-auto h-[5px] w-10 shrink-0 rounded-pill bg-lichen" />
      <div className="flex items-center justify-between gap-3">
        <WalkTabs walk={walk} block={block} onSelect={onSelectWalk} idPrefix="walk-tab-phone" panelId="walk-panel-phone" />
        <p className="m-0 shrink-0 text-sm font-semibold tabular-nums">{formatWalkKm(lengthM)}</p>
      </div>
      <div id="walk-panel-phone" role="tabpanel" aria-labelledby={`walk-tab-phone-${walk}`} className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            disabled={lengthM <= 0}
            aria-label={playbackToggleLabel(playing, distanceM, lengthM)}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border-0 bg-budbreak text-forest disabled:opacity-50"
          >
            {playing ? (
              <Pause aria-hidden="true" size={18} fill="currentColor" strokeWidth={1.8} />
            ) : (
              <Play aria-hidden="true" size={18} fill="currentColor" strokeWidth={1.8} />
            )}
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm text-ink-muted tabular-nums">
              <div aria-live="polite">{valueText}</div>
              <div>{timeLeftLabel(remainingMetres(lengthM, distanceM))}</div>
            </div>
            <ProgressSlider fraction={fraction} onSeek={onSeek} tone="moss" label="Walk progress" valueText={valueText} />
          </div>
        </div>
        <div className="flex items-center gap-3.5 rounded-sheet bg-paper p-4">
          {next ? <KindMark kind={next.kind} size="lg" /> : null}
          <div className="min-w-0">
            <div className="text-[13px] text-ink-muted">Next stop</div>
            <div className="font-display text-[22px] leading-[1.15] font-bold">{copy.heading}</div>
            <div className="text-[13px] text-ink-muted">{copy.detail}</div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <Button size="lg" className="min-h-[52px] flex-1" disabled={!next} onClick={() => next && onCheck(next.id)}>
            Mark as checked
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="min-h-[52px] px-[22px]"
            disabled={!next}
            onClick={() => next && onSkip(next.id)}
          >
            Skip
          </Button>
        </div>
        <Button size="lg" variant="outline" className="min-h-[52px] w-full" onClick={onOpenTasks}>
          Tasks
        </Button>
      </div>
    </section>
  );
}
