/** Preview pace at 1×. 8× and 32× are the same scale, not a walking speed. */
export const PLAYBACK_METRES_PER_SECOND = 80;

export const PLAYBACK_SPEEDS = [1, 8, 32] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export function isPlaybackSpeed(value: number): value is PlaybackSpeed {
  return value === 1 || value === 8 || value === 32;
}

export function advancePlayback(distanceM: number, lengthM: number, dtSeconds: number, speed: number): number {
  if (!Number.isFinite(lengthM) || lengthM <= 0) return 0;
  const start = Number.isFinite(distanceM) ? Math.max(0, Math.min(lengthM, distanceM)) : 0;
  const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
  const rate = Number.isFinite(speed) && speed > 0 ? speed : 1;
  return Math.min(lengthM, start + dt * PLAYBACK_METRES_PER_SECOND * rate);
}

export function playbackFraction(distanceM: number, lengthM: number): number {
  if (!Number.isFinite(lengthM) || lengthM <= 0 || !Number.isFinite(distanceM)) return 0;
  return Math.max(0, Math.min(1, distanceM / lengthM));
}

export function playbackToggleLabel(playing: boolean, distanceM: number, lengthM: number): string {
  if (playing) return "Pause playback";
  if (lengthM > 0 && distanceM >= lengthM - 0.05) return "Replay playback";
  return "Play playback";
}

export function remainingMetres(lengthM: number, distanceM: number): number {
  if (!Number.isFinite(lengthM) || lengthM <= 0) return 0;
  const travelled = Number.isFinite(distanceM) ? Math.max(0, Math.min(lengthM, distanceM)) : 0;
  return lengthM - travelled;
}
