const NOT_MEASURED = "Not measured";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const kilometreFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const hectareFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

export function formatInt(n: number): string {
  if (!Number.isFinite(n)) return NOT_MEASURED;
  return integerFormat.format(Math.round(n));
}

/** Metres to a one-decimal kilometre string, for example 39100 → "39.1 km". */
export function formatKm(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return NOT_MEASURED;
  return `${kilometreFormat.format(meters / 1000)} km`;
}

/** Hectares, up to two decimals, for example 21.8 → "21.8 ha" and 145 → "145 ha". */
export function formatHa(hectares: number): string {
  if (!Number.isFinite(hectares) || hectares < 0) return NOT_MEASURED;
  return `${hectareFormat.format(hectares)} ha`;
}

/** A percentage already expressed in percent points, for example 38 → "38%". */
export function formatPct(percent: number): string {
  if (!Number.isFinite(percent)) return NOT_MEASURED;
  return `${percentFormat.format(percent)}%`;
}

/**
 * Walking time at a steady pace. 8000 m at 4 km/h is "2 h".
 * 79 minutes is "1 h 19 min".
 */
export function formatDuration(meters: number, kmh = 4): string {
  if (!Number.isFinite(meters) || meters < 0 || !Number.isFinite(kmh) || kmh <= 0) return NOT_MEASURED;
  const totalMinutes = Math.round((meters / (kmh * 1000)) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

/** ISO date `2026-09-20` → `20 Sep 2026`. */
export function formatDay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return NOT_MEASURED;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return NOT_MEASURED;
  return `${Number(match[3])} ${month} ${match[1]}`;
}
