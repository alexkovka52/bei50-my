export type WalkRole = "inspector" | "farmer";
export type TaskKind = "gap" | "waste";
export type KindFilter = "all" | "gap" | "waste";

export type FieldTask = {
  id: string;
  kind: TaskKind;
  block: string | null;
  row: number | null;
  gap_m: number | null;
  priority: number;
};

export type AlongTask = {
  id: string;
  distanceM: number;
  priority: number;
};

/** A stop you are standing on stays "next" until the walk is 15 m past it. */
export const ARRIVE_M = 15;

const BLOCK_ID = /^[A-Za-z][A-Za-z0-9-]{0,15}$/;

export function parseWalkParam(value: string | string[] | undefined): WalkRole {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "farmer" ? "farmer" : "inspector";
}

export function parseBlockParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const id = raw.trim();
  return BLOCK_ID.test(id) ? id : null;
}

export function walkHref(walk: WalkRole, block: string | null): string {
  const params = new URLSearchParams();
  if (walk === "farmer") params.set("walk", "farmer");
  if (block) params.set("block", block);
  const query = params.toString();
  return query ? `/walks?${query}` : "/walks";
}

export function doneStorageKey(taskId: string): string {
  return `dementra.walk.done.${taskId}`;
}

export function filterTasks<T extends FieldTask>(
  tasks: readonly T[],
  options: { walk?: WalkRole; block?: string | null; kind?: KindFilter },
): T[] {
  const kind = options.kind ?? "all";
  return tasks
    .filter((task) => {
      if (options.walk === "farmer" && task.kind !== "waste") return false;
      if (options.block && task.block !== options.block) return false;
      if (kind === "gap" && task.kind !== "gap") return false;
      if (kind === "waste" && task.kind !== "waste") return false;
      return true;
    })
    .sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function kindCounts(tasks: readonly { kind: TaskKind }[]): { all: number; gap: number; waste: number } {
  let gap = 0;
  let waste = 0;
  for (const task of tasks) {
    if (task.kind === "gap") gap += 1;
    else waste += 1;
  }
  return { all: tasks.length, gap, waste };
}

function place(task: Pick<FieldTask, "block" | "row">): string {
  if (task.block && task.row != null) return `${task.block} row ${task.row}`;
  if (task.block) return task.block;
  return "the vineyard";
}

export function taskHeading(task: Pick<FieldTask, "kind" | "block" | "row" | "gap_m">): string {
  if (task.kind === "waste") return task.block ? `Waste, ${task.block}` : "Waste";
  const where = place(task);
  if (task.gap_m == null || !Number.isFinite(task.gap_m)) return `Gap, ${where}`;
  return `${Math.round(task.gap_m)} m gap, ${where}`;
}

export function taskNote(kind: TaskKind, where: "list" | "next"): string {
  if (kind === "gap") return where === "next" ? "Count the missing plants" : "Missing plants";
  return "Collect before spraying";
}

export function nextTaskAhead<T extends AlongTask>(
  tasks: readonly T[],
  currentM: number,
  lengthM: number,
  excluded: ReadonlySet<string>,
): T | null {
  if (!Number.isFinite(lengthM) || lengthM <= 0) return null;
  const current = Number.isFinite(currentM) ? Math.max(0, Math.min(lengthM, currentM)) : 0;
  let best: T | null = null;
  let bestForward = Infinity;
  for (const task of tasks) {
    if (excluded.has(task.id) || !Number.isFinite(task.distanceM)) continue;
    const delta = task.distanceM - current;
    const forward = delta >= -ARRIVE_M ? Math.max(0, delta) : lengthM - current + task.distanceM;
    const closer = forward < bestForward - 1e-6;
    const tie =
      best !== null &&
      Math.abs(forward - bestForward) <= 1e-6 &&
      (task.priority < best.priority || (task.priority === best.priority && task.id < best.id));
    if (best === null || closer || tie) {
      best = task;
      bestForward = forward;
    }
  }
  return best;
}
