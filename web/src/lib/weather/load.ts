import { unstable_cache, unstable_noStore as noStore } from "next/cache";
import type { LonLat } from "@/lib/data/types";
import { FORECAST_REVALIDATE_SECONDS, forecastRevalidateSeconds } from "@/lib/weather/cache-policy";
import { parseForecast } from "@/lib/weather/parse";
import type { Forecast } from "@/lib/weather/types";
import { forecastUrl } from "@/lib/weather/url";

async function readForecast(longitude: number, latitude: number): Promise<Forecast> {
  const response = await fetch(forecastUrl(longitude, latitude), {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Forecast responded ${response.status}`);
  const forecast = parseForecast(await response.json());
  if (!forecast || forecastRevalidateSeconds(forecast) == null) throw new Error("Forecast could not be read");
  return forecast;
}

/**
 * Live forecast. A parsed payload is cached for 30 minutes.
 * A timeout, a bad response, or an unreadable body is not cached, and the page must not keep that miss.
 */
export async function loadForecast(center: LonLat): Promise<Forecast | null> {
  const [longitude, latitude] = center;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  try {
    return await unstable_cache(() => readForecast(longitude, latitude), ["dementra-forecast", longitude.toFixed(4), latitude.toFixed(4)], {
      revalidate: FORECAST_REVALIDATE_SECONDS,
    })();
  } catch {
    noStore();
    return null;
  }
}
