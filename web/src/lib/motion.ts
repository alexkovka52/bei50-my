/** Shared timings for React, CSS and the MapLibre camera. */
export const MOTION = {
  surface: 700,
  fade: 350,
  feedback: 220,
  camera: 900,
  distance: 10,
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export const MOTION_VARS = {
  "--motion-surface": `${MOTION.surface}ms`,
  "--motion-fade": `${MOTION.fade}ms`,
  "--motion-feedback": `${MOTION.feedback}ms`,
  "--motion-distance": `${MOTION.distance}px`,
  "--motion-ease": MOTION.easing,
};

export function motionDuration(milliseconds: number) {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : milliseconds;
}

export function cameraAnimation() {
  return { duration: motionDuration(MOTION.camera), easing: (t: number) => t * t * (3 - 2 * t) };
}
