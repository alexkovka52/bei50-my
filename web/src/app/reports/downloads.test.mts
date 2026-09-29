import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { describeDownloads, formatBytes } from "./downloads.ts";

test("formatBytes uses decimal groups of 1024", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(692), "692 B");
  assert.equal(formatBytes(15303), "14.9 KB");
  assert.equal(formatBytes(1024), "1.0 KB");
  assert.equal(formatBytes(4_471_398), "4.3 MB");
  assert.equal(formatBytes(-1), "Not measured");
});

test("describeDownloads keeps the published order and appends unknown files", () => {
  const rows = describeDownloads([
    { path: "notes.txt", bytes: 12 },
    { path: "layers/gaps.geojson", bytes: 2048 },
    { path: "summary.json", bytes: 692 },
    { path: "routes/farmer.geojson", bytes: 3000 },
  ]);
  assert.deepEqual(
    rows.map((row) => row.label),
    ["Summary", "Farmer route", "Gaps", "notes.txt"],
  );
  assert.equal(rows[0]?.size, "692 B");
  assert.equal(rows[1]?.path, "routes/farmer.geojson");
  assert.equal(rows[3]?.size, "12 B");
});

test("describeDownloads names every file published under public/data", () => {
  const root = fileURLToPath(new URL("../../../public/data", import.meta.url));
  const files: { path: string; bytes: number }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        files.push({ path: path.relative(root, full).split(path.sep).join("/"), bytes: statSync(full).size });
      }
    }
  };
  walk(root);
  const rows = describeDownloads(files);
  assert.equal(rows.length, files.length);
  assert.equal(rows[0]?.path, "summary.json");
  assert.equal(rows[0]?.label, "Summary");
  for (const file of files) {
    assert.equal(rows.filter((row) => row.path === file.path).length, 1);
  }
  assert.ok(rows.some((row) => row.path === "layers/plants.geojson" && row.label === "Plants"));
  assert.ok(rows.some((row) => row.path === "routes/inspector.geojson"));
  assert.ok(rows.some((row) => row.path === "model.json"));
});
