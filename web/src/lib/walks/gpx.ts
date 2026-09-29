import type { Coordinate } from "../route-path";

export type GpxWaypoint = {
  at: Coordinate;
  name: string;
  description?: string;
  type?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function latLon(point: Coordinate): string | null {
  const lon = point[0];
  const lat = point[1];
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  return `lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"`;
}

/** GPX 1.1: the walk is one track, and each field task is a waypoint. */
export function buildGpx(options: { name: string; coordinates: readonly Coordinate[]; waypoints: readonly GpxWaypoint[] }): string {
  const name = escapeXml(options.name);
  const waypoints = options.waypoints
    .map((waypoint) => {
      const where = latLon(waypoint.at);
      if (!where) return "";
      const description = waypoint.description ? `<desc>${escapeXml(waypoint.description)}</desc>` : "";
      const type = waypoint.type ? `<type>${escapeXml(waypoint.type)}</type>` : "";
      return `<wpt ${where}><name>${escapeXml(waypoint.name)}</name>${description}${type}</wpt>`;
    })
    .filter(Boolean);
  const track = options.coordinates
    .map((point) => {
      const where = latLon(point);
      return where ? `<trkpt ${where}></trkpt>` : "";
    })
    .filter(Boolean);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="Dementra" xmlns="http://www.topografix.com/GPX/1/1">`,
    `<metadata><name>${name}</name></metadata>`,
    ...waypoints,
    `<trk><name>${name}</name><trkseg>`,
    ...track,
    `</trkseg></trk>`,
    `</gpx>`,
    ``,
  ].join("\n");
}
