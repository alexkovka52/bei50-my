import { strict as assert } from "node:assert";
import { test } from "node:test";
import { phoneNextStopCopy } from "./phone-copy.ts";

test("an empty walk says there are no stops, and a finished walk says so", () => {
  assert.deepEqual(phoneNextStopCopy({ nextHeading: null, nextNote: null, taskCount: 0 }), {
    heading: "No stops",
    detail: "There are no stops for this walk and block.",
  });
  assert.deepEqual(phoneNextStopCopy({ nextHeading: "Waste item, V08", nextNote: "Collect before spraying", taskCount: 3 }), {
    heading: "Waste item, V08",
    detail: "Collect before spraying",
  });
  assert.deepEqual(phoneNextStopCopy({ nextHeading: null, nextNote: null, taskCount: 4 }), {
    heading: "No stop ahead",
    detail: "Every task on this walk is checked or skipped.",
  });
});
