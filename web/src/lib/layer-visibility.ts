import type { Map } from "maplibre-gl";
import { MOTION, motionDuration } from "./motion";
type OpacityProperty = "fill-opacity" | "line-opacity" | "circle-opacity" | "circle-stroke-opacity";

/** Fade real geospatial layers while preserving their original paint opacity. */
export function createLayerVisibility(map: Map, groups: Record<string, string[]>) {
  const paint = new globalThis.Map<string, Array<[OpacityProperty, number]>>();
  const timers = new globalThis.Map<string, ReturnType<typeof setTimeout>>();
  for (const id of Object.values(groups).flat()) {
    const layer = map.getLayer(id);
    if (!layer || !["circle", "fill", "line"].includes(layer.type)) continue;
    const properties: OpacityProperty[] = layer.type === "circle" ? ["circle-opacity", "circle-stroke-opacity"] : layer.type === "fill" ? ["fill-opacity"] : ["line-opacity"];
    paint.set(id, properties.map((property) => [property, Number(map.getPaintProperty(id, property) ?? 1)]));
  }
  return {
    set(visible: Record<string, boolean>, animate = true) {
      const duration = animate ? motionDuration(MOTION.surface) : 0;
      for (const [key, ids] of Object.entries(groups)) {
        for (const id of ids) {
          const original = paint.get(id);
          if (!original || !map.getLayer(id)) continue;
          clearTimeout(timers.get(id));
          timers.delete(id);
          if (visible[key]) map.setLayoutProperty(id, "visibility", "visible");
          for (const [property, opacity] of original) {
            map.setPaintProperty(id, `${property}-transition`, { duration, delay: 0 });
            map.setPaintProperty(id, property, visible[key] ? opacity : 0);
          }
          if (!visible[key]) {
            if (!duration) map.setLayoutProperty(id, "visibility", "none");
            else timers.set(id, setTimeout(() => {
              if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
              timers.delete(id);
            }, duration));
          }
        }
      }
    },
    dispose() {
      timers.forEach(clearTimeout);
      timers.clear();
    },
  };
}
