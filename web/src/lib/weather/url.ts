/** Open-Meteo 7-day forecast for a WGS84 point, Europe/Chisinau. */
export function forecastUrl(longitude: number, latitude: number): string {
  return (
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${latitude}&longitude=${longitude}` +
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum" +
    "&timezone=Europe%2FChisinau&forecast_days=7"
  );
}
