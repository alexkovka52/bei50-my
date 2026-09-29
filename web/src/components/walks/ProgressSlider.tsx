import { cn } from "@/lib/utils";

type ProgressSliderProps = {
  fraction: number;
  onSeek: (fraction: number) => void;
  label: string;
  valueText: string;
  tone: "lime" | "moss";
  disabled?: boolean;
};

export function ProgressSlider({ fraction, onSeek, label, valueText, tone, disabled }: ProgressSliderProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const lime = tone === "lime";
  return (
    <div className="relative h-11">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 right-0 left-0 h-2 -translate-y-1/2 rounded-pill",
          lime ? "bg-[rgba(227,238,212,0.16)]" : "bg-[#CFDCC4]",
        )}
      >
        <div
          className={cn("h-full rounded-pill", lime ? "bg-budbreak" : "bg-moss")}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(clamped * 1000)}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={valueText}
        onChange={(event) => onSeek(Number(event.target.value) / 1000)}
        className="absolute inset-0 m-0 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-forest [&::-moz-range-thumb]:bg-dew [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[13px] [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-forest [&::-webkit-slider-thumb]:bg-dew"
      />
    </div>
  );
}
