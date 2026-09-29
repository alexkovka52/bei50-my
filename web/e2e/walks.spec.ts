import fs from "node:fs";
import { consoleProblems, expect, loadSummary, skipOnPhone, test, walkKm } from "./fixtures";

const summary = loadSummary();

test("Farmer tab switches the distance to the farmer walk", async ({ page }, testInfo) => {
  skipOnPhone(testInfo, "Phone layout under 481px has no Farmer tab.");
  await page.goto("/walks");
  await expect(page.getByText(walkKm(summary.walks.inspector.length_m), { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Farmer" }).click();
  await expect(page.getByText(walkKm(summary.walks.farmer.length_m), { exact: true })).toBeVisible();
});

test("marking the first task Done persists after reload", async ({ page }, testInfo) => {
  skipOnPhone(testInfo, "Phone layout under 481px has no task list Done checkbox.");
  await page.goto("/walks");
  const checkbox = page.getByRole("list", { name: "Field tasks" }).getByRole("listitem").first().getByRole("checkbox", { name: "Done" });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await page.reload();
  await expect(
    page.getByRole("list", { name: "Field tasks" }).getByRole("listitem").first().getByRole("checkbox", { name: "Done" }),
  ).toBeChecked();
});

test("Download GPX produces a file containing a gpx element", async ({ page }, testInfo) => {
  skipOnPhone(testInfo, "Phone layout under 481px has no Download GPX button.");
  await page.goto("/walks");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download GPX" }).click();
  const download = await downloadPromise;
  const target = `/tmp/${download.suggestedFilename()}`;
  await download.saveAs(target);
  expect(fs.readFileSync(target, "utf8")).toContain("<gpx");
});

test("play and pause change the walk progress text", async ({ page, observations }, testInfo) => {
  skipOnPhone(testInfo, "Phone layout under 481px has no play/pause control.");
  await page.goto("/walks");
  const bar = page.getByRole("region", { name: "Walk on the map" });
  const slider = bar.getByRole("slider", { name: "Walk progress" });
  const start = `${(0).toFixed(2)} of ${walkKm(summary.walks.inspector.length_m)}`;
  await expect(slider).toHaveAttribute("aria-valuetext", start);
  await page.getByRole("button", { name: "Play playback" }).click();
  await expect(slider).not.toHaveAttribute("aria-valuetext", start);
  const moved = await slider.getAttribute("aria-valuetext");
  expect(moved).toBeTruthy();
  await expect(bar.getByText(moved!, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause playback" }).click();
  await expect(page.getByRole("button", { name: "Play playback" })).toBeVisible();
  const paused = await slider.getAttribute("aria-valuetext");
  await page.waitForTimeout(400);
  await expect(slider).toHaveAttribute("aria-valuetext", paused!);
  expect(consoleProblems(observations)).toEqual([]);
});
