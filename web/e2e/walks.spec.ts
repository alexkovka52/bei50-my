import fs from "node:fs";
import type { Page } from "@playwright/test";
import { consoleProblems, expect, loadSummary, test, walkKm } from "./fixtures";

const summary = loadSummary();

function visible(page: Page, role: "tab" | "button" | "list" | "slider", name: string) {
  return page.getByRole(role, { name }).filter({ visible: true });
}

/** Phone keeps the task list behind the Tasks sheet. Wide screens show it beside the map. */
async function openTasksIfPhone(page: Page) {
  const tasks = page.getByRole("button", { name: "Tasks" });
  const list = page.getByRole("list", { name: "Field tasks" });
  // The walk is revealed after first paint, so a one-shot count misses the phone button.
  await expect(async () => {
    expect((await tasks.isVisible()) || (await list.isVisible())).toBeTruthy();
  }).toPass();
  if (await tasks.isVisible()) {
    await tasks.click();
    await expect(list).toBeVisible();
  }
}

test("Farmer tab switches the distance to the farmer walk", async ({ page }) => {
  await page.goto("/walks");
  await expect(page.getByText(walkKm(summary.walks.inspector.length_m), { exact: true }).filter({ visible: true })).toBeVisible();
  await visible(page, "tab", "Farmer").click();
  await expect(page.getByText(walkKm(summary.walks.farmer.length_m), { exact: true }).filter({ visible: true })).toBeVisible();
});

test("marking the first task Done persists after reload", async ({ page }) => {
  await page.goto("/walks");
  await openTasksIfPhone(page);
  const checkbox = visible(page, "list", "Field tasks").getByRole("listitem").first().getByRole("checkbox", { name: "Done" });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await page.reload();
  await openTasksIfPhone(page);
  await expect(visible(page, "list", "Field tasks").getByRole("listitem").first().getByRole("checkbox", { name: "Done" })).toBeChecked();
});

test("Download GPX produces a file containing a gpx element", async ({ page }) => {
  await page.goto("/walks");
  await openTasksIfPhone(page);
  const downloadPromise = page.waitForEvent("download");
  await visible(page, "button", "Download GPX").click();
  const download = await downloadPromise;
  const target = `/tmp/${download.suggestedFilename()}`;
  await download.saveAs(target);
  expect(fs.readFileSync(target, "utf8")).toContain("<gpx");
});

test("play and pause change the walk progress text", async ({ page, observations }) => {
  await page.goto("/walks");
  const bar = page.getByRole("region", { name: "Walk on the map" });
  const slider = bar.getByRole("slider", { name: "Walk progress" }).filter({ visible: true });
  const start = `${(0).toFixed(2)} of ${walkKm(summary.walks.inspector.length_m)}`;
  await expect(slider).toHaveAttribute("aria-valuetext", start);
  await visible(page, "button", "Play playback").click();
  await expect(slider).not.toHaveAttribute("aria-valuetext", start);
  const moved = await slider.getAttribute("aria-valuetext");
  expect(moved).toBeTruthy();
  await expect(bar.getByText(moved!, { exact: true }).filter({ visible: true })).toBeVisible();
  await visible(page, "button", "Pause playback").click();
  await expect(visible(page, "button", "Play playback")).toBeVisible();
  const paused = await slider.getAttribute("aria-valuetext");
  await page.waitForTimeout(400);
  await expect(slider).toHaveAttribute("aria-valuetext", paused!);
  expect(consoleProblems(observations)).toEqual([]);
});
