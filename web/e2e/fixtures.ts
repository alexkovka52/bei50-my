import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type ConsoleMessage, type Page, type TestInfo } from "@playwright/test";

/** Local ortho pyramid. TILES_DEV_ORIGIN only rewrites in `next dev`, so tests serve these files themselves. */
const TILE_ROOT = "/Users/cristian/Development/gigahack2026/bei50/dist/tiles/ortho";

const TILE_404 =
  /\/tiles\/ortho\/|terrarium|World_Imagery|openaerialmap|arcgisonline|elevation-tiles-prod/i;

export type Observations = {
  errors: string[];
  notFound: string[];
};

function isTileUrl(url: string): boolean {
  return TILE_404.test(url);
}

function isTile404Message(text: string): boolean {
  return TILE_404.test(text) && /\b404\b|Not Found/i.test(text);
}

export function consoleProblems(sink: Observations): string[] {
  const nonTile404 = sink.notFound.filter((url) => !isTileUrl(url));
  return sink.errors.filter((text) => {
    if (isTile404Message(text)) return false;
    if (/^Failed to load resource: the server responded with a status of 404\b/.test(text)) {
      return nonTile404.length > 0 || sink.notFound.length === 0;
    }
    return true;
  });
}

function contentType(file: string): string {
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

async function installTileRoute(page: Page) {
  if (!fs.existsSync(TILE_ROOT)) return;
  const root = path.resolve(TILE_ROOT);
  await page.route("**/tiles/ortho/**", async (route) => {
    const url = new URL(route.request().url());
    const rel = decodeURIComponent(url.pathname.replace(/^\/tiles\/ortho\//, "")).replace(/^\/+/, "");
    const file = path.resolve(root, rel);
    const inside = file === root || file.startsWith(`${root}${path.sep}`);
    if (!inside || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      await route.fulfill({ status: 404, body: "not found" });
      return;
    }
    await route.fulfill({ path: file, contentType: contentType(file) });
  });
}

export const test = base.extend<{ observations: Observations }>({
  page: async ({ page }, use) => {
    await installTileRoute(page);
    await use(page);
  },
  observations: async ({ page }, use) => {
    const sink: Observations = { errors: [], notFound: [] };
    const onResponse = (response: { status(): number; url(): string }) => {
      if (response.status() === 404) sink.notFound.push(response.url());
    };
    const onConsole = (msg: ConsoleMessage) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (isTile404Message(text)) return;
      sink.errors.push(text);
    };
    const onPageError = (error: Error) => {
      if (isTile404Message(error.message)) return;
      sink.errors.push(error.message);
    };
    page.on("response", onResponse);
    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    await use(sink);
  },
});

export { expect };

export function counted(n: number, singular: string, plural: string): string {
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
  return `${formatted} ${n === 1 ? singular : plural}`;
}

export function walkKm(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

type SummaryFile = {
  farm: string;
  counts: { gaps: number; waste: number; blocks: number };
  walks: { inspector: { length_m: number }; farmer: { length_m: number } };
};

type BlocksFile = { blocks: { id: string; plants: number }[] };

type ModelFile = { metrics: { label: string }[] };

function readJson<T>(file: string): T {
  const dataDir = path.join(__dirname, "../public/data");
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8")) as T;
}

export function loadSummary(): SummaryFile {
  return readJson<SummaryFile>("summary.json");
}

export function loadBlocks(): BlocksFile["blocks"] {
  return readJson<BlocksFile>("blocks.json").blocks;
}

export function loadModelLabels(): string[] {
  return readJson<ModelFile>("model.json").metrics.map((metric) => metric.label);
}

export function statusHeadline(summary: SummaryFile): string {
  const { gaps, waste, blocks } = summary.counts;
  const gapText = counted(gaps, "planting gap", "planting gaps");
  const wasteText = counted(waste, "waste item", "waste items");
  const blockText = counted(blocks, "block", "blocks");
  return `${gapText} and ${wasteText} are waiting across ${blockText}.`;
}

/** Block that sorting by plants descending puts first (ties break toward the earlier id). */
export function blockWithMostPlants(blocks: { id: string; plants: number }[]): { id: string; plants: number } {
  return blocks.slice().sort((a, b) => {
    if (a.plants !== b.plants) return b.plants - a.plants;
    return a.id.localeCompare(b.id, "en", { numeric: true, sensitivity: "base" });
  })[0]!;
}

export async function expectOneHeading(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
}

export async function seriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
}

export async function settleMaps(page: Page) {
  const canvas = page.locator("canvas").first();
  if ((await canvas.count()) === 0) {
    await canvas.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
    return;
  }
  await canvas.waitFor({ state: "visible", timeout: 20_000 });
}

/** Phone walk column (tabs, task list, GPX, playback bar) is specified only from 481px up. */
export function skipOnPhone(testInfo: TestInfo, reason: string) {
  test.skip(testInfo.project.name === "mobile", reason);
}
