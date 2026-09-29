import { expect, loadModelLabels, test } from "./fixtures";

test("every reports download returns 200", async ({ page }) => {
  await page.goto("/reports");
  const table = page.getByRole("table", { name: "Published data files" });
  await expect(table).toBeVisible();
  const links = table.getByRole("link");
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const href = await links.nth(index).getAttribute("href");
    expect(href, `download ${index}`).toBeTruthy();
    const response = await page.request.get(href!);
    expect(response.status(), href!).toBe(200);
  }
});

test("AI page shows every metric label from model.json", async ({ page }) => {
  await page.goto("/ai");
  for (const label of loadModelLabels()) {
    await expect(page.getByRole("rowheader", { name: label, exact: true })).toBeVisible();
  }
});
