/** A parsed forecast is reused for half an hour. A failure is not cached. */
export const FORECAST_REVALIDATE_SECONDS = 1800;

export function forecastRevalidateSeconds(forecast: unknown): number | null {
  return forecast == null ? null : FORECAST_REVALIDATE_SECONDS;
}
