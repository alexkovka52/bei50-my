import { strict as assert } from "node:assert";
import { register } from "node:module";
import { test } from "node:test";

const globalScope = globalThis as { __dementraAlias?: boolean };
if (!globalScope.__dementraAlias) {
  globalScope.__dementraAlias = true;
  register(new URL("../weather/resolve-alias.mjs", import.meta.url));
}

const { walkSentence } = await import("./coverage.ts");

test("walk copy matches how many targets the route actually reaches", () => {
  const base = { role: "inspector" as const, lengthM: 7991.683, stops: 0, visited: null, total: null };
  assert.equal(walkSentence(base), "The inspector walk covers 7.99 km, about 2 h.");
  assert.equal(walkSentence({ ...base, visited: 40, total: 83 }), "One inspector walk visits 40 of them: 7.99 km, about 2 h.");
  assert.equal(walkSentence({ ...base, visited: 83, total: 83 }), "One inspector walk visits all of them: 7.99 km, about 2 h.");
  assert.equal(walkSentence({ ...base, visited: 83, total: null }), "The inspector walk covers 7.99 km, about 2 h.");
  assert.equal(
    walkSentence({ role: "farmer", lengthM: 2000, stops: 1, visited: 3, total: 4 }),
    "One farmer walk visits 3 of them: 2.00 km, about 30 min.",
  );
  assert.equal(
    walkSentence({ role: "inspector", lengthM: 2000, stops: 2, visited: null, total: null }),
    "The inspector walk covers 2.00 km, about 30 min, 2 stops.",
  );
});
