import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const NOT_MEASURED = "Not measured";

const LABELS: { path: string; label: string }[] = [
  { path: "summary.json", label: "Summary" },
  { path: "blocks.json", label: "Blocks" },
  { path: "rows.json", label: "Rows" },
  { path: "tasks.json", label: "Tasks" },
  { path: "model.json", label: "Model scores" },
  { path: "routes/inspector.geojson", label: "Inspector route" },
  { path: "routes/farmer.geojson", label: "Farmer route" },
  { path: "layers/plants.geojson", label: "Plants" },
  { path: "layers/rows.geojson", label: "Row lines" },
  { path: "layers/interrows.geojson", label: "Inter-rows" },
  { path: "layers/gaps.geojson", label: "Gaps" },
  { path: "layers/waste.geojson", label: "Waste" },
  { path: "layers/blocks.geojson", label: "Block outlines" },
  { path: "layers/passages.geojson", label: "Passages" },
  { path: "layers/forbidden.geojson", label: "Forbidden ground" },
  { path: "layers.pmtiles", label: "All layers, PMTiles" },
];

const LABEL_BY_PATH = new Map(LABELS.map((item) => [item.path, item.label]));
const RANK = new Map(LABELS.map((item, index) => [item.path, index]));

export type PublishedFile = { path: string; bytes: number };

export type DownloadRow = PublishedFile & { label: string; size: string };

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return NOT_MEASURED;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB"] as const;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

export function describeDownloads(files: readonly PublishedFile[]): DownloadRow[] {
  return files
    .map((file) => ({
      path: file.path,
      bytes: file.bytes,
      label: LABEL_BY_PATH.get(file.path) ?? file.path,
      size: formatBytes(file.bytes),
    }))
    .sort((a, b) => {
      const left = RANK.get(a.path);
      const right = RANK.get(b.path);
      if (left !== undefined && right !== undefined) return left - right;
      if (left !== undefined) return -1;
      if (right !== undefined) return 1;
      return a.path.localeCompare(b.path, "en");
    });
}

export async function readPublishedFiles(): Promise<PublishedFile[]> {
  const root = path.join(process.cwd(), "public", "data");
  const found: PublishedFile[] = [];

  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = path.relative(root, full).split(path.sep).join("/");
      if (relative.startsWith("..") || relative.includes("..")) continue;
      const bytes = (await stat(full)).size;
      found.push({ path: relative, bytes });
    }
  }

  await walk(root);
  return found;
}
