import { strict as assert } from "node:assert";
import { register } from "node:module";
import { test } from "node:test";

const globalScope = globalThis as { __dementraAlias?: boolean };
if (!globalScope.__dementraAlias) {
  globalScope.__dementraAlias = true;
  register(new URL("./resolve-alias.mjs", import.meta.url));
}

const { temperatureBarBox, temperatureScale } = await import("./bars.ts");
const { weekdayNames } = await import("./calendar.ts");
const { parseForecast } = await import("./parse.ts");
const { dryClause, formatWindKmh, frostRisk, nightClause, weatherSentence } = await import("./sentence.ts");
const { forecastUrl } = await import("./url.ts");
const { weatherPresentation } = await import("./wmo.ts");

const LIVE = {
  current: {
    time: "2026-09-29T19:45",
    temperature_2m: 16.1,
    relative_humidity_2m: 52,
    wind_speed_10m: 5.4,
    weather_code: 1,
  },
  daily: {
    time: ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"],
    temperature_2m_max: [21.2, 19.2, 19.8, 19.4, 19.5, 21.2, 22.6],
    temperature_2m_min: [11.2, 7.0, 5.1, 5.7, 3.5, 4.7, 7.9],
    precipitation_sum: [0, 0, 0, 0, 0, 0, 0],
  },
};

test("forecast URL matches the Open-Meteo contract for Sireț", () => {
  assert.equal(
    forecastUrl(28.7120576, 47.1215059),
    "https://api.open-meteo.com/v1/forecast?latitude=47.1215059&longitude=28.7120576&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe%2FChisinau&forecast_days=7",
  );
});

test("weekday names stay on the calendar date", () => {
  assert.deepEqual(weekdayNames("2026-09-29"), { weekday: "Tuesday", weekdayShort: "Tue" });
  assert.deepEqual(weekdayNames("2026-10-03"), { weekday: "Saturday", weekdayShort: "Sat" });
  assert.equal(weekdayNames("2026-02-31"), null);
  assert.equal(weekdayNames("09-29"), null);
});

test("WMO codes map to a label and an icon", () => {
  assert.deepEqual(weatherPresentation(0), { label: "Clear", icon: "sun" });
  assert.deepEqual(weatherPresentation(1), { label: "Mainly clear", icon: "sun" });
  assert.deepEqual(weatherPresentation(2), { label: "Partly cloudy", icon: "cloud-sun" });
  assert.deepEqual(weatherPresentation(3), { label: "Overcast", icon: "cloud" });
  assert.deepEqual(weatherPresentation(45), { label: "Fog", icon: "cloud-fog" });
  assert.deepEqual(weatherPresentation(61), { label: "Rain", icon: "cloud-rain" });
  assert.deepEqual(weatherPresentation(71), { label: "Snow", icon: "cloud-snow" });
  assert.deepEqual(weatherPresentation(95), { label: "Thunderstorm", icon: "cloud-lightning" });
  assert.deepEqual(weatherPresentation(96), { label: "Thunderstorm with hail", icon: "cloud-lightning" });
  assert.deepEqual(weatherPresentation(123), { label: "Weather", icon: "cloud" });
});

test("parses a live Open-Meteo body and rejects incomplete ones", () => {
  const forecast = parseForecast(LIVE);
  assert.ok(forecast);
  assert.equal(forecast.temperatureC, 16.1);
  assert.equal(forecast.weatherCode, 1);
  assert.equal(forecast.windKmh, 5.4);
  assert.equal(forecast.observedOn, "2026-09-29");
  assert.equal(forecast.days.length, 7);
  assert.equal(forecast.days[4]?.weekday, "Saturday");
  assert.equal(forecast.days[4]?.minC, 3.5);
  assert.equal(parseForecast(null), null);
  assert.equal(parseForecast({ current: { temperature_2m: 1 } }), null);
  assert.equal(parseForecast({ ...LIVE, daily: { ...LIVE.daily, precipitation_sum: [0] } }), null);
  assert.equal(parseForecast({ ...LIVE, current: { ...LIVE.current, weather_code: "1" } }), null);
});

test("night sentence names the day only under 8 °C", () => {
  const forecast = parseForecast(LIVE);
  assert.ok(forecast);
  assert.equal(nightClause(forecast.days), "Cold nights ahead, lowest 3.5 °C on Saturday.");
  const mild = forecast.days.map((day) => ({ ...day, minC: day.minC + 10 }));
  assert.equal(nightClause(mild), "Mild nights, lowest 13.5 °C.");
  const exactlyEight = forecast.days.map((day, index) => ({ ...day, minC: index === 4 ? 8 : 12 }));
  assert.equal(nightClause(exactlyEight), "Mild nights, lowest 8.0 °C.");
  const justUnder = forecast.days.map((day, index) => ({ ...day, minC: index === 4 ? 7.9 : 12 }));
  assert.equal(nightClause(justUnder), "Cold nights ahead, lowest 7.9 °C on Saturday.");
});

test("dry days run until the first millimetre", () => {
  const forecast = parseForecast(LIVE);
  assert.ok(forecast);
  assert.equal(dryClause(forecast.days), "Dry all week");
  const monday = forecast.days.map((day, index) => ({ ...day, precipitationMm: index === 6 ? 1 : 0.9 }));
  assert.equal(dryClause(monday), "Dry until Monday");
  const today = forecast.days.map((day, index) => ({ ...day, precipitationMm: index === 0 ? 4 : 0 }));
  assert.equal(dryClause(today), "Rain today");
  const trace = forecast.days.map((day) => ({ ...day, precipitationMm: 0.99 }));
  assert.equal(dryClause(trace), "Dry all week");
});

test("the forecast sentence joins nights, dry days and wind", () => {
  const forecast = parseForecast(LIVE);
  assert.ok(forecast);
  assert.equal(weatherSentence(forecast.days, forecast.windKmh), "Cold nights ahead, lowest 3.5 °C on Saturday. Dry all week; wind 5.4 km/h.");
  assert.equal(formatWindKmh(16), "16 km/h");
  assert.equal(formatWindKmh(16.24), "16.2 km/h");
  assert.equal(weatherSentence([], 5), null);
});

test("frost is a night at or below 2 °C", () => {
  const forecast = parseForecast(LIVE);
  assert.ok(forecast);
  assert.equal(frostRisk(forecast.days), false);
  const frosty = forecast.days.map((day, index) => ({ ...day, minC: index === 2 ? 2 : day.minC }));
  assert.equal(frostRisk(frosty), true);
  const justAbove = forecast.days.map((day) => ({ ...day, minC: 2.1 }));
  assert.equal(frostRisk(justAbove), false);
});

test("min/max bars share one scale", () => {
  const forecast = parseForecast(LIVE);
  assert.ok(forecast);
  assert.deepEqual(temperatureScale(forecast.days), { min: 3.5, max: 22.6 });
  const cold = temperatureBarBox(3.5, 19.5, 3.5, 22.6);
  const warm = temperatureBarBox(11.2, 21.2, 3.5, 22.6);
  assert.ok(cold.heightPct > 0 && cold.topPct >= 0);
  assert.ok(warm.topPct < cold.topPct);
  assert.deepEqual(temperatureBarBox(5, 5, 5, 5), { topPct: 40, heightPct: 20 });
  assert.deepEqual(temperatureScale([]), { min: 0, max: 1 });
});
