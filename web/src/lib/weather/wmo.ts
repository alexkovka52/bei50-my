export const WEATHER_ICONS = ["sun", "cloud-sun", "cloud", "cloud-fog", "cloud-drizzle", "cloud-rain", "cloud-snow", "cloud-lightning"] as const;

export type WeatherIcon = (typeof WEATHER_ICONS)[number];

export type WeatherPresentation = {
  label: string;
  icon: WeatherIcon;
};

const PRESENTATION: Record<number, WeatherPresentation> = {
  0: { label: "Clear", icon: "sun" },
  1: { label: "Mainly clear", icon: "sun" },
  2: { label: "Partly cloudy", icon: "cloud-sun" },
  3: { label: "Overcast", icon: "cloud" },
  45: { label: "Fog", icon: "cloud-fog" },
  48: { label: "Fog", icon: "cloud-fog" },
  51: { label: "Drizzle", icon: "cloud-drizzle" },
  53: { label: "Drizzle", icon: "cloud-drizzle" },
  55: { label: "Drizzle", icon: "cloud-drizzle" },
  56: { label: "Freezing drizzle", icon: "cloud-drizzle" },
  57: { label: "Freezing drizzle", icon: "cloud-drizzle" },
  61: { label: "Rain", icon: "cloud-rain" },
  63: { label: "Rain", icon: "cloud-rain" },
  65: { label: "Rain", icon: "cloud-rain" },
  66: { label: "Freezing rain", icon: "cloud-rain" },
  67: { label: "Freezing rain", icon: "cloud-rain" },
  71: { label: "Snow", icon: "cloud-snow" },
  73: { label: "Snow", icon: "cloud-snow" },
  75: { label: "Snow", icon: "cloud-snow" },
  77: { label: "Snow grains", icon: "cloud-snow" },
  80: { label: "Rain showers", icon: "cloud-rain" },
  81: { label: "Rain showers", icon: "cloud-rain" },
  82: { label: "Rain showers", icon: "cloud-rain" },
  85: { label: "Snow showers", icon: "cloud-snow" },
  86: { label: "Snow showers", icon: "cloud-snow" },
  95: { label: "Thunderstorm", icon: "cloud-lightning" },
  96: { label: "Thunderstorm with hail", icon: "cloud-lightning" },
  99: { label: "Thunderstorm with hail", icon: "cloud-lightning" },
};

const UNKNOWN: WeatherPresentation = { label: "Weather", icon: "cloud" };

/** WMO weather interpretation code (WW) → short label and icon name. */
export function weatherPresentation(code: number): WeatherPresentation {
  if (!Number.isFinite(code)) return UNKNOWN;
  return PRESENTATION[Math.trunc(code)] ?? UNKNOWN;
}
