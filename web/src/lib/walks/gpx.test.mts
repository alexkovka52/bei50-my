import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildGpx, gpxFileName, wholeWalkTrackNote } from "./gpx.ts";

test("buildGpx writes GPX 1.1 with lat/lon swapped from GeoJSON and escaped names", () => {
  const xml = buildGpx({
    name: "Inspector & walk",
    coordinates: [
      [28.7073776, 47.1230335],
      [28.71, 47.13],
    ],
    waypoints: [
      {
        at: [28.7024789, 47.1273226],
        name: `64 m gap <V04>`,
        description: "Missing plants",
        type: "gap",
      },
    ],
  });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<gpx version="1\.1" creator="Dementra" xmlns="http:\/\/www\.topografix\.com\/GPX\/1\/1">/);
  assert.match(xml, /<name>Inspector &amp; walk<\/name>/);
  assert.match(xml, /<wpt lat="47\.1273226" lon="28\.7024789"><name>64 m gap &lt;V04&gt;<\/name><desc>Missing plants<\/desc><type>gap<\/type><\/wpt>/);
  assert.match(xml, /<trkpt lat="47\.1230335" lon="28\.7073776"><\/trkpt>\n<trkpt lat="47\.1300000" lon="28\.7100000"><\/trkpt>/);
});

test("a block filter is named on the file and described as the whole walk", () => {
  assert.equal(gpxFileName("inspector", null), "inspector-walk.gpx");
  assert.equal(gpxFileName("inspector", "  "), "inspector-walk.gpx");
  assert.equal(gpxFileName("farmer", "V01"), "farmer-walk-V01.gpx");
  assert.equal(wholeWalkTrackNote(null), null);
  assert.equal(wholeWalkTrackNote("V01"), "The track is the whole walk. Stops in the file are for block V01.");
});

test("buildGpx drops coordinates that are not WGS84", () => {
  const xml = buildGpx({
    name: "Farmer walk",
    coordinates: [
      [629504.7, 5220250.75],
      [28.7, 47.12],
    ],
    waypoints: [{ at: [Number.NaN, 47], name: "skip" }],
  });
  assert.equal(xml.includes("<wpt "), false);
  assert.equal(xml.includes("629504"), false);
  assert.match(xml, /<trkpt lat="47\.1200000" lon="28\.7000000"><\/trkpt>/);
});
