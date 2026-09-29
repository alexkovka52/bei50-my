/** Plants are a 4 MB GeoJSON. Fetch them only when the canopy layer is on and readable. */
export const PLANTS_MIN_ZOOM = 16;

export function shouldLoadPlants(zoom: number, visible: boolean): boolean {
  return visible && Number.isFinite(zoom) && zoom >= PLANTS_MIN_ZOOM;
}
