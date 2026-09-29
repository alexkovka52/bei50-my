"use client";

import { formatWalkKm, timeLeftLabel } from "@/lib/walks/format";
import { playbackFraction, remainingMetres } from "@/lib/walks/playback";
import type { TaskKind } from "@/lib/walks/tasks";
import { Button } from "@/components/ui/Button";
import { KindMark } from "./KindMark";
import { ProgressSlider } from "./ProgressSlider";

export type NextStop = {
  id: string;
  kind: TaskKind;
  heading: string;
  note: string;
};

export function PhoneSheet({
  lengthM,
  distanceM,
  next,
  onSeek,
  onCheck,
  onSkip,
}: {
  lengthM: number;
  distanceM: number;
  next: NextStop | null;
  onSeek: (fraction: number) => void;
  onCheck: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const fraction = playbackFraction(distanceM, lengthM);
  const valueText = `${formatWalkKm(distanceM, false)} of ${formatWalkKm(lengthM)}`;
  return (
    <section
      aria-label="Walk progress"
      className="flex h-[330px] max-h-[52dvh] flex-col gap-3.5 overflow-y-auto rounded-t-[28px] bg-dew px-5 pt-3.5 pb-7 text-forest"
    >
      <div aria-hidden="true" className="mx-auto h-[5px] w-10 shrink-0 rounded-pill bg-lichen" />
      <div className="flex items-baseline justify-between gap-3 text-sm text-ink-muted tabular-nums">
        <div aria-live="polite">{valueText}</div>
        <div>{timeLeftLabel(remainingMetres(lengthM, distanceM))}</div>
      </div>
      <ProgressSlider fraction={fraction} onSeek={onSeek} tone="moss" label="Walk progress" valueText={valueText} />
      <div className="flex items-center gap-3.5 rounded-sheet bg-paper p-4">
        {next ? <KindMark kind={next.kind} size="lg" /> : null}
        <div className="min-w-0">
          <div className="text-[13px] text-ink-muted">Next stop</div>
          <div className="font-display text-[22px] leading-[1.15] font-bold">
            {next ? next.heading : "No stop ahead"}
          </div>
          <div className="text-[13px] text-ink-muted">
            {next ? next.note : "Every task on this walk is checked or skipped."}
          </div>
        </div>
      </div>
      <div className="mt-auto flex gap-2.5">
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
    </section>
  );
}
