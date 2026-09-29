import { consoleProblems, expect, loadSummary, test } from "./fixtures";

const summary = loadSummary();

async function openMap(page: import("@playwright/test").Page, search = "") {
  await page.goto(`/map${search}`);
  await expect(page.locator(`canvas[aria-label="${summary.farm} map"]`)).toBeVisible();
}

async function gapsSwitch(page: import("@playwright/test").Page) {
  const toggle = page.getByRole("switch", { name: "Gaps" });
  if ((await toggle.count()) === 0) {
    await page.getByRole("button", { name: "Layers", exact: true }).click();
  }
  return page.getByRole("switch", { name: "Gaps" });
}

test("map draws a MapLibre canvas", async ({ page, observations }) => {
  await openMap(page);
  const box = await page.locator(`canvas[aria-label="${summary.farm} map"]`).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);
  expect(consoleProblems(observations)).toEqual([]);
});

test("layers panel toggles Gaps off and back on", async ({ page }) => {
  await openMap(page);
  const gaps = await gapsSwitch(page);
  await expect(gaps).toHaveAttribute("aria-checked", "true");
  await gaps.click();
  await expect(gaps).toHaveAttribute("aria-checked", "false");
  await gaps.click();
  await expect(gaps).toHaveAttribute("aria-checked", "true");
});

test("searching V02 opens the block inspector", async ({ page }) => {
  await openMap(page);
  const box = page.getByRole("textbox", { name: "Find a block or row" });
  await box.fill("V02");
  await box.press("Enter");
  await expect(page.getByRole("heading", { name: "Block V02" })).toBeVisible();
  await expect(page).toHaveURL(/[?&]block=V02(?:&|$)/);
});

test("2D and 3D toggle moves the camera", async ({ page }) => {
  await openMap(page);
  const view = page.getByRole("radiogroup", { name: "View" });
  await expect(view.getByRole("radio", { name: "3D" })).toBeChecked();
  await view.getByRole("radio", { name: "2D" }).click();
  await expect(view.getByRole("radio", { name: "2D" })).toBeChecked();
  await expect(page.locator('button[aria-label="Reset north, north"]')).toHaveCount(1);
  await view.getByRole("radio", { name: "3D" }).click();
  await expect(view.getByRole("radio", { name: "3D" })).toBeChecked();
  await expect(page.locator('button[aria-label="Reset north, 10° west of north"]')).toHaveCount(1);
});

test("?block=V02 opens the inspector", async ({ page }) => {
  await openMap(page, "?block=V02");
  await expect(page.getByRole("heading", { name: "Block V02" })).toBeVisible();
});
