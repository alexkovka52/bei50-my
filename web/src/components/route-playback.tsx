"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as VineyardMap, GeoJSONSource } from "maplibre-gl";
import { LocateFixed, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { distanceM, pointAtDistance, routeFeature, routeWithEndpoints, snapToRoute, type RouteEndpoints, type RoutePath, type RouteRole } from "@/lib/route-path";
import { cameraAnimation } from "@/lib/motion";

export type WalkRoutes = Record<RouteRole, RoutePath | null>;
type Pick = { role: RouteRole; kind: "start" | "end" } | null;
const roles: RouteRole[] = ["inspector", "farmer"];
const speeds = [0.5, 1, 2, 4, 8, 16, 32];
const colors = { inspector: "#438bff", farmer: "#f05d55" };
const emptyCollection = { type: "FeatureCollection" as const, features: [] };
const defaults: Record<RouteRole, RouteEndpoints> = {
  inspector: { start: 0, end: 0, customEnd: false },
  farmer: { start: 0, end: 0, customEnd: false },
};

export function useRoutePlayback({ map, routes, mode, visible, onMessage }: {
  map: VineyardMap | null;
  routes: WalkRoutes | null;
  mode: RouteRole | "both";
  visible: Record<RouteRole, boolean>;
  onMessage: (message: string) => void;
}) {
  const [endpoints, setEndpoints] = useState(defaults);
  const [picking, setPicking] = useState<Pick>(null);
  const [state, setState] = useState<"idle" | "playing" | "paused" | "finished">("idle");
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);
  const metres = useRef(0);
  const speedRef = useRef(speed);
  const pickingRef = useRef<Pick>(null);
  const activeMap = useRef<VineyardMap | null>(null);
  const primary: RouteRole = mode === "farmer" ? "farmer" : "inspector";
  const { inspector: inspectorVisible, farmer: farmerVisible } = visible;
  const paths = useMemo<WalkRoutes>(() => ({
    inspector: routes?.inspector ? routeWithEndpoints(routes.inspector, endpoints.inspector) : null,
    farmer: routes?.farmer ? routeWithEndpoints(routes.farmer, endpoints.farmer) : null,
  }), [routes, endpoints]);
  const activeRoles = useMemo(() => roles.filter((role) => (mode === "both" || mode === role) && paths[role]), [mode, paths]);
  const durationM = Math.max(0, ...activeRoles.map((role) => paths[role]?.lengthM || 0));
  const cancelAnimation = useCallback(() => window.cancelAnimationFrame(frame.current), []);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { pickingRef.current = picking; }, [picking]);

  useEffect(() => {
    if (!map || !routes) return;
    activeMap.current = map;
    for (const role of roles) {
      const path = routes[role];
      map.addSource(`playback-${role}`, { type: "geojson", lineMetrics: true, data: path ? routeFeature(path, role) : emptyCollection });
      map.addLayer({ id: `playback-${role}-trail`, type: "line", source: `playback-${role}`, layout: { "line-cap": "round", "line-join": "round", visibility: "none" }, paint: { "line-width": 5, "line-gradient": ["literal", "rgba(0,0,0,0)"] } });
    }
    map.addSource("playback-markers", { type: "geojson", data: emptyCollection });
    for (const role of roles) map.addLayer({ id: `playback-${role}-marker`, type: "circle", source: "playback-markers", filter: ["==", ["get", "role"], role], paint: { "circle-radius": 8, "circle-color": colors[role], "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
    map.addSource("route-endpoints", { type: "geojson", data: emptyCollection });
    map.addLayer({ id: "route-endpoint-markers", type: "circle", source: "route-endpoints", paint: { "circle-radius": 7, "circle-color": ["match", ["get", "kind"], "start", "#d1fb55", "#ff9829"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });

    const click = (event: import("maplibre-gl").MapMouseEvent) => {
      const pick = pickingRef.current;
      const path = pick && routes[pick.role];
      if (!pick || !path) return;
      const snap = snapToRoute(path, [event.lngLat.lng, event.lngLat.lat]);
      if (snap.offsetM > 30) {
        onMessage("Choose a point closer to the route (within 30 m). Zoom in for precise selection.");
        return;
      }
      setEndpoints((previous) => {
        const current = previous[pick.role];
        const next = pick.kind === "start"
          ? { ...current, start: snap.distance, end: current.customEnd ? current.end : snap.distance }
          : { ...current, end: snap.distance, customEnd: true };
        return { ...previous, [pick.role]: next };
      });
      setPicking(null);
      onMessage(`${pick.kind === "start" ? "Start" : "Finish"} selected on the ${pick.role} walk${snap.offsetM > 1 ? ` · snapped ${Math.round(snap.offsetM)} m to the route` : ""}.`);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setPicking(null); };
    map.on("click", click);
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimation();
      activeMap.current = null;
      map.off("click", click);
      document.removeEventListener("keydown", escape);
    };
  }, [map, routes, onMessage, cancelAnimation]);

  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    if (picking) canvas.dataset.picking = "true";
    else delete canvas.dataset.picking;
    canvas.style.cursor = picking ? "crosshair" : "";
  }, [map, picking]);

  const draw = useCallback((travelled: number, show: boolean) => {
    const current = activeMap.current;
    if (!current) return;
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    for (const role of activeRoles) {
      const path = paths[role];
      if (!path) continue;
      const ratio = path.lengthM ? Math.min(1, travelled / path.lengthM) : 0;
      current.setPaintProperty(`playback-${role}-trail`, "line-gradient", ["step", ["line-progress"], colors[role], ratio, ratio >= 1 ? colors[role] : "rgba(0,0,0,0)"]);
      if (show) features.push({ type: "Feature", properties: { role }, geometry: { type: "Point", coordinates: pointAtDistance(path, travelled) } });
    }
    (current.getSource("playback-markers") as GeoJSONSource).setData({ type: "FeatureCollection", features });
  }, [activeRoles, paths]);

  useEffect(() => {
    if (!map || !routes || !activeMap.current) return;
    cancelAnimation();
    metres.current = 0;
    setProgress(0);
    setState("idle");
    for (const role of roles) {
      const path = paths[role];
      if (!path) continue;
      (map.getSource(role) as GeoJSONSource).setData(routeFeature(path, role));
      (map.getSource(`playback-${role}`) as GeoJSONSource).setData(routeFeature(path, role));
    }
    draw(0, false);
  }, [map, routes, paths, mode, draw, cancelAnimation]);

  useEffect(() => {
    if (!map || !activeMap.current) return;
    for (const role of roles) {
      const show = (role === "inspector" ? inspectorVisible : farmerVisible) && (mode === "both" || mode === role) && state !== "idle";
      for (const suffix of ["trail", "marker"]) map.setLayoutProperty(`playback-${role}-${suffix}`, "visibility", show ? "visible" : "none");
    }
    const base = routes?.[primary];
    const chosen = endpoints[primary];
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    if (base) {
      const start = pointAtDistance(base, chosen.start);
      const end = pointAtDistance(base, chosen.end);
      features.push({ type: "Feature", properties: { kind: "start" }, geometry: { type: "Point", coordinates: start } });
      if (distanceM(start, end) > 0.2) features.push({ type: "Feature", properties: { kind: "end" }, geometry: { type: "Point", coordinates: end } });
    }
    (map.getSource("route-endpoints") as GeoJSONSource).setData({ type: "FeatureCollection", features });
  }, [map, routes, primary, endpoints, mode, state, inspectorVisible, farmerVisible]);

  useEffect(() => {
    if (state !== "playing" || !map || !durationM) return;
    let previous = 0;
    let rendered = 0;
    let reported = 0;
    const tick = (time: number) => {
      if (!activeMap.current) return;
      const seconds = previous ? Math.min(0.25, (time - previous) / 1000) : 0;
      previous = time;
      // A visualization speed, not a claim about a person's walking pace.
      metres.current = Math.min(durationM, metres.current + seconds * 80 * speedRef.current);
      if (time - rendered >= 33 || metres.current >= durationM) { draw(metres.current, true); rendered = time; }
      if (time - reported >= 200 || metres.current >= durationM) { setProgress(metres.current / durationM); reported = time; }
      if (metres.current >= durationM) { setState("finished"); return; }
      frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    return cancelAnimation;
  }, [state, map, durationM, draw, cancelAnimation]);

  function fit() {
    if (!map) return;
    const coordinates = activeRoles.flatMap((role) => paths[role]?.coordinates || []);
    if (!coordinates.length) return;
    const bounds = coordinates.reduce((box, point) => [Math.min(box[0], point[0]), Math.min(box[1], point[1]), Math.max(box[2], point[0]), Math.max(box[3], point[1])], [Infinity, Infinity, -Infinity, -Infinity]);
    const width = map.getCanvas().clientWidth;
    const side = Math.min(340, width * 0.3);
    map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: width < 700 ? 35 : { top: 80, bottom: 90, left: side, right: side }, ...cameraAnimation(), maxZoom: 18 });
  }

  function toggle() {
    if (!durationM) return;
    if (state === "playing") { cancelAnimation(); setState("paused"); return; }
    if (state === "finished" || state === "idle") { metres.current = 0; setProgress(0); fit(); }
    setState("playing");
  }

  function reset() {
    cancelAnimation();
    metres.current = 0;
    setProgress(0);
    setState("idle");
    draw(0, false);
  }

  function seek(percent: number) {
    if (!durationM) return;
    metres.current = durationM * Math.max(0, Math.min(100, percent)) / 100;
    setProgress(metres.current / durationM);
    if (state !== "playing") setState(percent >= 100 ? "finished" : "paused");
    draw(metres.current, true);
  }

  function pick(kind: "start" | "end") {
    reset();
    setPicking({ role: primary, kind });
  }

  function restoreEndpoints() { reset(); setEndpoints((current) => ({ ...current, [primary]: { ...defaults[primary] } })); }

  const startPoint = routes?.[primary] ? pointAtDistance(routes[primary], endpoints[primary].start) : null;
  const endPoint = routes?.[primary] ? pointAtDistance(routes[primary], endpoints[primary].end) : null;
  return { state, speed, progress, picking, primary, startPoint, endPoint, ready: Boolean(durationM && map), lengths: { inspector: paths.inspector?.lengthM, farmer: paths.farmer?.lengthM }, toggle, reset, seek, fit, pick, restoreEndpoints, cancelPick: () => setPicking(null), cancelAnimation, slower: () => setSpeed((current) => speeds[Math.max(0, speeds.indexOf(current) - 1)]), faster: () => setSpeed((current) => speeds[Math.min(speeds.length - 1, speeds.indexOf(current) + 1)]) };
}

export function RoutePlaybackControls({ player, reveal }: { player: ReturnType<typeof useRoutePlayback>; reveal: () => void }) {
  const formatPoint = (point: [number, number] | null) => point ? `${point[1].toFixed(5)}, ${point[0].toFixed(5)}` : "Loading…";
  return <div className="route-playback-controls">
    <p className="field-label">{player.primary === "inspector" ? "Inspector" : "Farmer"} endpoints</p>
    <div className="route-endpoint-buttons">
      <button type="button" className="choice endpoint-choice" disabled={!player.ready} onClick={() => { reveal(); player.pick("start"); }} aria-label="Select route start"><span className="endpoint-dot start" />Select start<small>{formatPoint(player.startPoint)}</small></button>
      <button type="button" className="choice endpoint-choice" disabled={!player.ready} onClick={() => { reveal(); player.pick("end"); }} aria-label="Select route end"><span className="endpoint-dot end" />Select finish<small>{formatPoint(player.endPoint)}</small></button>
    </div>
    <button type="button" className="route-text-button" onClick={player.restoreEndpoints} disabled={!player.ready}>Restore official endpoints</button>
    <p className="route-endpoint-note">Pick on the existing walk. The complete inspection remains included.</p>
    <div className="playback-actions">
      <button type="button" className="playback-play" disabled={!player.ready} onClick={() => { if (player.state !== "playing") reveal(); player.toggle(); }} aria-label={player.state === "playing" ? "Pause route animation" : "Play route animation"}>
        {player.state === "playing" ? <Pause size={17} /> : <Play size={17} />} {player.state === "playing" ? "Pause" : player.state === "finished" ? "Replay" : "Play"}
      </button>
      <button type="button" className="playback-icon" onClick={player.reset} disabled={!player.ready} aria-label="Reset route animation" title="Reset animation"><RotateCcw size={17} /></button>
      <button type="button" className="playback-icon" onClick={player.fit} disabled={!player.ready} aria-label="Fit route on map" title="Show entire route"><LocateFixed size={17} /></button>
    </div>
    <div className="playback-speed"><span>Speed</span><button type="button" className="playback-icon" onClick={player.slower} disabled={player.speed === speeds[0]} aria-label="Decrease playback speed"><Minus size={15} /></button><output aria-label="Playback speed">{player.speed}×</output><button type="button" className="playback-icon" onClick={player.faster} disabled={player.speed === speeds[speeds.length - 1]} aria-label="Increase playback speed"><Plus size={15} /></button></div>
    <input className="playback-progress" type="range" min={0} max={100} step={0.1} value={Math.round(player.progress * 1000) / 10} onChange={(event) => player.seek(Number(event.target.value))} disabled={!player.ready} aria-label="Route animation progress" aria-valuetext={`${Math.round(player.progress * 100)} percent`} />
    <div className="playback-status" aria-live="off"><span>{player.state === "playing" ? "Playing" : player.state === "paused" ? "Paused" : player.state === "finished" ? "Finished" : "Ready to play"}</span><span>{Math.round(player.progress * 100)}%</span></div>
  </div>;
}
