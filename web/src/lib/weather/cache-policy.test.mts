import { strict as assert } from "node:assert";
import { test } from "node:test";
import { FORECAST_REVALIDATE_SECONDS, forecastRevalidateSeconds } from "./cache-policy.ts";

test("only a parsed forecast is cached, and a failure is not", () => {
  assert.equal(forecastRevalidateSeconds({ temperatureC: 16 }), FORECAST_REVALIDATE_SECONDS);
  assert.equal(FORECAST_REVALIDATE_SECONDS, 1800);
  assert.equal(forecastRevalidateSeconds(null), null);
  assert.equal(forecastRevalidateSeconds(undefined), null);
});
