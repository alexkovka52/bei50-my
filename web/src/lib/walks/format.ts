// @ts-expect-error Node's test runner needs a .ts specifier, which tsc rejects.
import { formatDuration } from "../data/format.ts";

export function formatWalkKm(meters: number, withUnit = true): string {
  if (!Number.isFinite(meters) || meters < 0) return "Not measured";
  const number = (meters / 1000).toFixed(2);
  return withUnit ? `${number} km` : number;
}

/** Walking time still ahead at 4 km/h, phrased like the playback bar. */
export function timeLeftLabel(metersLeft: number): string {
  const duration = formatDuration(metersLeft);
  if (duration === "Not measured") return duration;
  return `about ${duration} left`;
}
