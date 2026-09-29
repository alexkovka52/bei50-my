import { blockWithMostPlants, expect, loadBlocks, test } from "./fixtures";

const blocks = loadBlocks();
const top = blockWithMostPlants(blocks);
const plantsLabel = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(top.plants);

test("blocks table lists every published block", async ({ page }) => {
  await page.goto("/blocks");
  await expect(page.locator("tbody tr")).toHaveCount(blocks.length);
});

test("sorting by Plants puts the block with the most plants first", async ({ page }) => {
  await page.goto("/blocks");
  await page.getByRole("button", { name: "Sort by Plants" }).click();
  await expect(page.getByText(`${blocks.length} blocks, most plants first`)).toBeVisible();
  const first = page.locator("tbody tr").first();
  await expect(first.getByRole("rowheader")).toHaveText(top.id);
  await expect(first.getByRole("cell").nth(2)).toHaveText(plantsLabel);
});

test("selecting V03 puts selected=V03 in the address", async ({ page }) => {
  await page.goto("/blocks");
  await page.getByRole("rowheader", { name: "V03", exact: true }).click();
  await expect(page).toHaveURL(/[?&]selected=V03(?:&|$)/);
});

test("block V03 shows its title", async ({ page }) => {
  await page.goto("/blocks/V03");
  await expect(page.getByRole("heading", { level: 1, name: "Block V03" })).toBeVisible();
});

test("an unknown block is a 404", async ({ page }) => {
  const response = await page.goto("/blocks/NOPE");
  expect(response?.status()).toBe(404);
});
