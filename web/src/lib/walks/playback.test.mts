import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  advancePlayback,
  isPlaybackSpeed,
  playbackFraction,
  PLAYBACK_METRES_PER_SECOND,
  remainingMetres,
} from "./playback.ts";

test("advancePlayback moves at 80 m/s times the selected speed", () => {
  assert.equal(advancePlayback(0, 10_000, 1, 1), PLAYBACK_METRES_PER_SECOND);
  assert.equal(advancePlayback(0, 10_000, 1, 8), 640);
  assert.equal(advancePlayback(0, 10_000, 1, 32), 2560);
});

test("advancePlayback clamps the frame and the ends of the line", () => {
  assert.equal(advancePlayback(990, 1000, 1, 1), 1000);
  assert.equal(advancePlayback(-20, 1000, 1, 1), 80);
  assert.equal(advancePlayback(10, 1000, 0, 1), 10);
  assert.equal(advancePlayback(10, 1000, -1, 1), 10);
  assert.equal(advancePlayback(10, 0, 1, 1), 0);
  assert.equal(advancePlayback(Number.NaN, 1000, 1, 8), 640);
});

test("playbackFraction and remaining metres stay inside the walk", () => {
  assert.equal(playbackFraction(0, 8000), 0);
  assert.equal(playbackFraction(2000, 8000), 0.25);
  assert.equal(playbackFraction(9000, 8000), 1);
  assert.equal(playbackFraction(10, 0), 0);
  assert.equal(remainingMetres(8000, 2000), 6000);
  assert.equal(remainingMetres(8000, -5), 8000);
  assert.equal(remainingMetres(8000, 9000), 0);
});

test("playback speeds are the three preview steps", () => {
  assert.equal(isPlaybackSpeed(1), true);
  assert.equal(isPlaybackSpeed(8), true);
  assert.equal(isPlaybackSpeed(32), true);
  assert.equal(isPlaybackSpeed(2), false);
});
