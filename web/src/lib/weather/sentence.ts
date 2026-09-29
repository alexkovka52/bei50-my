import type { ForecastDay } from "@/lib/weather/types";

export function formatTemperatureC(celsius: number): string {
  return `${celsius.toFixed(1)} °C`;
}

export function formatWindKmh(speed: number): string {
  const rounded = Math.round(speed * 10) / 10;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${text} km/h`;
}

function coldest(days: ForecastDay[]): ForecastDay {
  return days.reduce((best, day) => (day.minC < best.minC ? day : best));
}

/** Night line. The day is named only when the lowest night is under 8 °C. */
export function nightClause(days: ForecastDay[]): string {
  const night = coldest(days);
  const temperature = formatTemperatureC(night.minC);
  if (night.minC < 8) return `Cold nights ahead, lowest ${temperature} on ${night.weekday}.`;
  return `Mild nights, lowest ${temperature}.`;
}

/** Dry stretch until the first day with at least 1 mm of precipitation. */
export function dryClause(days: ForecastDay[]): string {
  const wet = days.findIndex((day) => day.precipitationMm >= 1);
  if (wet < 0) return "Dry all week";
  if (wet === 0) return "Rain today";
  return `Dry until ${days[wet]?.weekday ?? "a wet day"}`;
}

export function weatherSentence(days: ForecastDay[], windKmh: number): string | null {
  if (days.length === 0 || !Number.isFinite(windKmh)) return null;
  return `${nightClause(days)} ${dryClause(days)}; wind ${formatWindKmh(windKmh)}.`;
}

/** True when any night reaches 2 °C or below. */
export function frostRisk(days: ForecastDay[]): boolean {
  return days.some((day) => day.minC <= 2);
}
