"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advancePlayback, type PlaybackSpeed } from "@/lib/walks/playback";

/**
 * Moves a distance along the walk. Playback starts only from the play control,
 * including when the visitor has asked for reduced motion.
 */
export function useWalkPlayback(lengthM: number) {
  const [distanceM, setDistanceM] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);
  const [follow, setFollow] = useState(false);
  const distanceRef = useRef(0);
  const speedRef = useRef<PlaybackSpeed>(1);
  const lengthRef = useRef(lengthM);
  lengthRef.current = lengthM;

  useEffect(() => {
    if (!playing) return;
    let last = 0;
    let reported = 0;
    let frame = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
      last = now;
      const next = advancePlayback(distanceRef.current, lengthRef.current, dt, speedRef.current);
      distanceRef.current = next;
      if (now - reported >= 32 || next >= lengthRef.current) {
        reported = now;
        setDistanceM(next);
      }
      if (next >= lengthRef.current) {
        setPlaying(false);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);

  const seek = useCallback((fraction: number) => {
    const length = lengthRef.current;
    const ratio = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
    const next = ratio * length;
    distanceRef.current = next;
    setDistanceM(next);
    if (length > 0 && next >= length) setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const length = lengthRef.current;
    if (length <= 0) return;
    setPlaying((current) => {
      if (current) return false;
      if (distanceRef.current >= length - 0.05) {
        distanceRef.current = 0;
        setDistanceM(0);
      }
      return true;
    });
  }, []);

  const setSpeed = useCallback((next: PlaybackSpeed) => {
    speedRef.current = next;
    setSpeedState(next);
  }, []);

  const reset = useCallback(() => {
    distanceRef.current = 0;
    setDistanceM(0);
    setPlaying(false);
  }, []);

  return { distanceM, playing, speed, follow, setFollow, seek, toggle, setSpeed, reset };
}
