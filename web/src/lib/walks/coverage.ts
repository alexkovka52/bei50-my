import { formatDuration, formatInt } from "@/lib/data/format";

export type WalkCoverage = {
  role: "inspector" | "farmer";
  lengthM: number;
  stops: number;
  visited: number | null;
  total: number | null;
};

function walkKm(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "Not measured";
  const km = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(meters / 1000);
  return `${km} km`;
}

function stopSuffix(stops: number): string {
  if (!Number.isFinite(stops) || stops <= 0) return "";
  const count = Math.round(stops);
  return `, ${formatInt(count)} ${count === 1 ? "stop" : "stops"}`;
}

function counted(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Describes one published walk. "Visits all" is only true when the route
 * recorded every target. Missing counts stay a distance, not a claim.
 */
export function walkSentence(coverage: WalkCoverage): string {
  const role = coverage.role === "farmer" ? "farmer" : "inspector";
  const tail = `${walkKm(coverage.lengthM)}, about ${formatDuration(coverage.lengthM)}${stopSuffix(coverage.stops)}.`;
  if (!counted(coverage.visited) || !counted(coverage.total)) {
    const name = role === "farmer" ? "The farmer walk" : "The inspector walk";
    return `${name} covers ${tail}`;
  }
  if (coverage.visited === coverage.total) return `One ${role} walk visits all of them: ${tail}`;
  return `One ${role} walk visits ${formatInt(coverage.visited)} of them: ${tail}`;
}
