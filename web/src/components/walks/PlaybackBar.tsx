"use client";

import { LocateFixed, Pause, Play } from "lucide-react";
import { formatWalkKm, timeLeftLabel } from "@/lib/walks/format";
import { PLAYBACK_SPEEDS, playbackFraction, remainingMetres, type PlaybackSpeed } from "@/lib/walks/playback";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ProgressSlider } from "./ProgressSlider";

export function PlaybackBar({
  lengthM,
  distanceM,
  playing,
  speed,
  follow,
  onToggle,
  onSeek,
  onSpeed,
  onFollow,
}: {
  lengthM: number;
  distanceM: number;
  playing: boolean;
  speed: PlaybackSpeed;
  follow: boolean;
  onToggle: () => void;
  onSeek: (fraction: number) => void;
  onSpeed: (speed: PlaybackSpeed) => void;
  onFollow: (follow: boolean) => void;
}) {
  const fraction = playbackFraction(distanceM, lengthM);
  const atEnd = lengthM > 0 && distanceM >= lengthM - 0.05;
  const valueText = `${formatWalkKm(distanceM, false)} of ${formatWalkKm(lengthM)}`;
  return (
    <GlassPanel className="flex flex-wrap items-center gap-x-[18px] gap-y-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={lengthM <= 0}
        aria-label={playing ? "Pause playback" : atEnd ? "Replay playback" : "Play playback"}
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border-0 bg-budbreak text-forest disabled:opacity-50"
      >
        {playing ? (
          <Pause aria-hidden="true" size={18} fill="currentColor" strokeWidth={1.8} />
        ) : (
          <Play aria-hidden="true" size={18} fill="currentColor" strokeWidth={1.8} />
        )}
      </button>
      <div className="flex min-w-[160px] flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
          <span className="font-semibold text-dew">{valueText}</span>
          <span className="text-mist">{timeLeftLabel(remainingMetres(lengthM, distanceM))}</span>
        </div>
        <ProgressSlider
          fraction={fraction}
          onSeek={onSeek}
          tone="lime"
          disabled={lengthM <= 0}
          label="Walk progress"
          valueText={valueText}
        />
      </div>
      <button
        type="button"
        aria-pressed={follow}
        onClick={() => onFollow(!follow)}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-full",
          follow ? "bg-budbreak text-forest" : "bg-[rgba(227,238,212,0.08)] text-dew",
        )}
      >
        <LocateFixed aria-hidden="true" size={18} strokeWidth={1.8} />
        <span className="sr-only">Follow the current position</span>
      </button>
      <div role="group" aria-label="Playback speed" className="flex gap-1 rounded-pill bg-[rgba(227,238,212,0.08)] p-1">
        {PLAYBACK_SPEEDS.map((option) => {
          const selected = option === speed;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onSpeed(option)}
              className={cn(
                "inline-flex h-11 min-w-11 items-center justify-center rounded-pill px-3 text-[13px]",
                selected ? "bg-dew font-semibold text-forest" : "text-mist",
              )}
            >
              {option}×
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}
