import { consoleProblems, expect, loadSummary, statusHeadline, test } from "./fixtures";

const summary = loadSummary();

test("overview status names the published gap, waste and block counts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(statusHeadline(summary))).toBeVisible();
});

test("weather card shows a temperature or says it is unavailable", async ({ page, observations }) => {
  await page.route("**/api.open-meteo.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        current: {
          time: "2026-09-29T12:00",
          temperature_2m: 18.2,
          relative_humidity_2m: 55,
          wind_speed_10m: 12,
          weather_code: 1,
        },
        daily: {
          time: ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"],
          temperature_2m_max: [20, 19, 18, 17, 16, 15, 14],
          temperature_2m_min: [8, 7, 6, 5, 4, 3, 2],
          precipitation_sum: [0, 0, 0, 0, 0, 0, 0],
        },
      }),
    });
  });

  await page.goto("/");
  const temperature = page.getByText(/\d+°/);
  const unavailable = page.getByText("Weather is unavailable right now.");
  await expect(temperature.or(unavailable).first()).toBeVisible();
  expect(consoleProblems(observations)).toEqual([]);
});
