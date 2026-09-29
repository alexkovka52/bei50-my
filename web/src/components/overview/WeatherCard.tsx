import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { temperatureBarBox, temperatureScale } from "@/lib/weather/bars";
import { frostRisk, weatherSentence } from "@/lib/weather/sentence";
import type { Forecast } from "@/lib/weather/types";
import { weatherPresentation, type WeatherIcon } from "@/lib/weather/wmo";
import { cn } from "@/lib/utils";

const ICONS: Record<WeatherIcon, LucideIcon> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  "cloud-fog": CloudFog,
  "cloud-drizzle": CloudDrizzle,
  "cloud-rain": CloudRain,
  "cloud-snow": CloudSnow,
  "cloud-lightning": CloudLightning,
};

export function WeatherCard({ forecast }: { forecast: Forecast | null }) {
  const sentence = forecast ? weatherSentence(forecast.days, forecast.windKmh) : null;
  const presentation = forecast ? weatherPresentation(forecast.weatherCode) : null;
  const Icon = presentation ? ICONS[presentation.icon] : null;
  const days = forecast?.days.slice(0, 7) ?? [];
  const scale = temperatureScale(days);
  const today = forecast?.observedOn;
  const frost = frostRisk(days);

  return (
    <Card className="flex h-full flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">Weather at Sireț</h2>
          <div className="text-[13px] text-ink-muted">Live, Open-Meteo</div>
        </div>
        {forecast && Icon && presentation ? (
          <div className="flex items-center gap-2.5">
            <Icon aria-hidden="true" size={30} strokeWidth={1.8} className="text-moss" />
            <div className="font-display text-[36px] font-bold leading-none tabular-nums">
              {Math.round(forecast.temperatureC)}°
              <span className="sr-only">, {presentation.label}</span>
            </div>
          </div>
        ) : null}
      </div>
      {forecast && sentence ? (
        <>
          <div className="grid h-[76px] grid-cols-7 items-end gap-1.5" aria-hidden="true">
            {days.map((day) => {
              const box = temperatureBarBox(day.minC, day.maxC, scale.min, scale.max);
              const current = day.date === today;
              return (
                <div key={day.date} className="flex flex-col items-center justify-end gap-1" title={`${day.weekday}: ${day.maxC.toFixed(1)}° / ${day.minC.toFixed(1)}°`}>
                  <div className="relative h-12 w-2.5">
                    <div
                      className="absolute inset-x-0 rounded-[6px]"
                      style={{
                        top: `${box.topPct}%`,
                        height: `${box.heightPct}%`,
                        background: day.minC <= 2 ? "linear-gradient(#6B9071, #E09A2D)" : "linear-gradient(#6B9071, #AEC3B0)",
                      }}
                    />
                  </div>
                  <div className={cn("text-[11px]", current ? "font-semibold text-forest" : "text-ink-muted")}>{day.weekdayShort}</div>
                </div>
              );
            })}
          </div>
          <p className="sr-only">
            {days.map((day) => `${day.weekday} high ${day.maxC.toFixed(1)} degrees, low ${day.minC.toFixed(1)} degrees.`).join(" ")}
          </p>
          <p className="m-0 text-sm leading-snug">{sentence}</p>
          {frost ? <p className="m-0 text-sm font-semibold text-gap">Frost warning</p> : null}
        </>
      ) : (
        <p className="m-0 text-sm leading-snug text-ink-muted">Weather is unavailable right now.</p>
      )}
    </Card>
  );
}
