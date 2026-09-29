import type { LonLat } from "@/lib/data/types";
import { parseForecast } from "@/lib/weather/parse";
import type { Forecast } from "@/lib/weather/types";
import { forecastUrl } from "@/lib/weather/url";

/** Live forecast. Cached for 30 minutes; a failure is null so the page never shows invented weather. */
export async function loadForecast(center: LonLat): Promise<Forecast | null> {
  const [longitude, latitude] = center;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  try {
    const response = await fetch(forecastUrl(longitude, latitude), {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    return parseForecast(await response.json());
  } catch {
    return null;
  }
}
