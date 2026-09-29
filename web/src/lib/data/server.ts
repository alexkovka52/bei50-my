import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { Block, BlocksFile, ModelFile, RowsFile, Summary, TasksFile, VineyardRow, Task } from "@/lib/data/types";

const DATA_ROOT = () => path.join(process.cwd(), "public", "data");

function isVersion1(value: unknown): value is { version: 1 } {
  return typeof value === "object" && value !== null && "version" in value && value.version === 1;
}

async function readVersioned<T extends { version: 1 }>(file: string): Promise<T | null> {
  if (file.includes("..") || path.isAbsolute(file)) return null;
  try {
    const raw = await readFile(path.join(DATA_ROOT(), file), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isVersion1(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export const getSummary = cache(async (): Promise<Summary | null> => readVersioned<Summary>("summary.json"));

export const getBlocks = cache(async (): Promise<Block[] | null> => {
  const file = await readVersioned<BlocksFile>("blocks.json");
  if (!file || !Array.isArray(file.blocks)) return null;
  return file.blocks;
});

export const getBlock = cache(async (id: string): Promise<Block | null> => {
  const blocks = await getBlocks();
  if (!blocks) return null;
  return blocks.find((block) => block.id === id) ?? null;
});

export const getRows = cache(async (): Promise<VineyardRow[] | null> => {
  const file = await readVersioned<RowsFile>("rows.json");
  if (!file || !Array.isArray(file.rows)) return null;
  return file.rows;
});

export const getTasks = cache(async (): Promise<Task[] | null> => {
  const file = await readVersioned<TasksFile>("tasks.json");
  if (!file || !Array.isArray(file.tasks)) return null;
  return file.tasks;
});

export const getModel = cache(async (): Promise<ModelFile | null> => readVersioned<ModelFile>("model.json"));
