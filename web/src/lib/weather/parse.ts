import { weekdayNames } from "@/lib/weather/calendar";
import type { Forecast, ForecastDay } from "@/lib/weather/types";

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numbers(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: number[] = [];
  for (const item of value) {
    const n = finite(item);
    if (n === null) return null;
    out.push(n);
  }
  return out;
}

function dates(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const date = /^(\d{4}-\d{2}-\d{2})/.exec(item)?.[1];
    if (!date || !weekdayNames(date)) return null;
    out.push(date);
  }
  return out;
}

/** Accept an Open-Meteo forecast body. Anything incomplete is rejected — callers must not invent weather. */
export function parseForecast(body: unknown): Forecast | null {
  const root = record(body);
  if (!root) return null;
  const current = record(root.current);
  const daily = record(root.daily);
  if (!current || !daily) return null;

  const temperatureC = finite(current.temperature_2m);
  const weatherCode = finite(current.weather_code);
  const windKmh = finite(current.wind_speed_10m);
  const time = dates(daily.time);
  const maxC = numbers(daily.temperature_2m_max);
  const minC = numbers(daily.temperature_2m_min);
  const precipitation = numbers(daily.precipitation_sum);
  if (temperatureC === null || weatherCode === null || windKmh === null || !time || !maxC || !minC || !precipitation) return null;
  if (time.length !== maxC.length || time.length !== minC.length || time.length !== precipitation.length) return null;

  const days: ForecastDay[] = [];
  for (let i = 0; i < time.length; i += 1) {
    const date = time[i];
    const names = date ? weekdayNames(date) : null;
    const dayMax = maxC[i];
    const dayMin = minC[i];
    const rain = precipitation[i];
    if (!date || !names || dayMax === undefined || dayMin === undefined || rain === undefined) return null;
    days.push({
      date,
      weekday: names.weekday,
      weekdayShort: names.weekdayShort,
      maxC: dayMax,
      minC: dayMin,
      precipitationMm: rain,
    });
  }

  const observed = typeof current.time === "string" ? /^(\d{4}-\d{2}-\d{2})/.exec(current.time)?.[1] : undefined;
  return {
    temperatureC,
    weatherCode,
    windKmh,
    observedOn: observed && weekdayNames(observed) ? observed : (days[0]?.date ?? ""),
    days,
  };
}
