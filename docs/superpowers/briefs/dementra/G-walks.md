# Task G — Walks and field tasks `/walks` (Layer 2)

Read `docs/superpowers/briefs/dementra/L2-common.md` first. Boards: `design/canvas/Walks.dc.html` (desktop)
and `design/canvas/Phone.dc.html` (≤480px).

Owned files: `web/src/app/walks/**`, `web/src/components/walks/**` (new), `web/src/lib/walks/**` (new).
You may reuse (import, don't edit) `web/src/lib/route-path.ts` and `web/src/lib/geo.ts`. The old playback
code is in git history for reference: `git show f5d8b24:web/src/components/route-playback.tsx`.

## Build
- Left column (420px) as on the board: title "Walks", Inspector/Farmer tabs (real tablist; `?walk=farmer`),
  summary card (distance from the route's `length_m`, on-foot time at 4 km/h, stops only when > 0, the
  start/finish sentence, "Send to phone" = copies a deep link to this walk and shows a toast, "Download
  GPX" = client-side GPX 1.1 of the route LineString with the tasks as waypoints).
- Task list `#tasks`: filter pills All / Gaps <n> / Waste <n> (farmer walk = waste only), optional
  `?block=V02` filter (chip with clear button), sorted by priority, virtualised or paginated (1,174 items),
  each row with a "Done" checkbox persisted in localStorage (key per task id) and a count of done tasks.
  Clicking a task flies the map to it.
- Map (right): `MapView` in **2D** (top-down, dark), route line from `routes/<walk>.geojson`: the walked part
  in budbreak lime, the rest dashed dew; start/finish pin from `summary.start`; gap/waste points; the
  current-position marker.
- Playback bar (glass, bottom of the map): play/pause (lime), progress slider (keyboard accessible),
  "<walked> of <total> km", "about <time> left", speed 1× / 8× / 32×, follow-camera toggle. Animate with
  requestAnimationFrame along the line using route-path helpers; respect reduced motion (no auto-play).
- Phone (≤480px): the Phone board: map on top, bottom sheet with progress, the next undone task on the
  route ("Next stop", nearest task ahead of the current position), "Mark as checked" (marks done) and "Skip".
- Pure logic (GPX builder, position-along-line, next-task-ahead, filters) in `web/src/lib/walks/` with
  node tests.
