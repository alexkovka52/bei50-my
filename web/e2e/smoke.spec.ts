import { consoleProblems, expect, expectOneHeading, loadSummary, seriousAxeViolations, settleMaps, statusHeadline, test } from "./fixtures";

const summary = loadSummary();

/** Every screen the app publishes, including a real block detail page. */
const ROUTES = ["/", "/map", "/walks", "/blocks", "/blocks/V03", "/reports", "/ai"] as const;

const MAP_ROUTES = new Set<string>(["/", "/map", "/walks", "/blocks", "/blocks/V03"]);

async function openRoute(page: import("@playwright/test").Page, route: (typeof ROUTES)[number]) {
  const response = await page.goto(route);
  expect(response?.status(), route).toBe(200);
  await expectOneHeading(page);
  if (route === "/") await expect(page.getByText(statusHeadline(summary))).toBeVisible();
  if (route === "/map") {
    await expect(page.locator(`canvas[aria-label="${summary.farm} map"]`)).toBeVisible();
  } else if (MAP_ROUTES.has(route)) {
    await settleMaps(page);
  }
}

test.describe("route health", () => {
  for (const route of ROUTES) {
    test(`${route} returns 200, has one h1, and no console errors`, async ({ page, observations }) => {
      await openRoute(page, route);
      expect(consoleProblems(observations), route).toEqual([]);
    });

    test(`${route} has no serious or critical axe violations`, async ({ page }, testInfo) => {
      await openRoute(page, route);
      const violations = await seriousAxeViolations(page);
      const ids = violations.map((violation) => violation.id);
      test.fixme(
        route === "/blocks" && ids.includes("aria-allowed-attr"),
        "Sort buttons set aria-sort, which the button role does not allow.",
      );
      test.fixme(
        testInfo.project.name === "mobile" &&
          (route === "/blocks/V03" || route === "/ai") &&
          ids.includes("scrollable-region-focusable"),
        "On a phone the wide table scrolls without a keyboard-focusable region.",
      );
      expect(ids, route).toEqual([]);
    });
  }
});
