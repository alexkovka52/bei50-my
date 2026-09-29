import { doneStorageKey } from "@/lib/walks/tasks";

export function readDone(ids: readonly string[]): Set<string> {
  const done = new Set<string>();
  if (typeof window === "undefined") return done;
  try {
    for (const id of ids) {
      if (window.localStorage.getItem(doneStorageKey(id)) === "1") done.add(id);
    }
  } catch {
    return done;
  }
  return done;
}

export function writeDone(id: string, done: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (done) window.localStorage.setItem(doneStorageKey(id), "1");
    else window.localStorage.removeItem(doneStorageKey(id));
  } catch {
    // Private mode and full storage still leave the checkbox working for this visit.
  }
}
