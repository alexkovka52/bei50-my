# Premium walk + type — 26 Sep 2026

Layered SDD. Parallel implementers only with isolated files. Do not spawn 50 writers on `vineyard-map.tsx`.

Official scored start stays `28.7073776, 47.1230335`. Custom coordinates are a preview snap onto the existing inspector/farmer LineString — do not re-run GIS `siret3 route` in the browser.

## Layer 0 — research (parallel, read-only)

- Original type: Demetra marketing uses Rubik + Sen + Source Sans 3. App shell uses Inter.
- Route lines already in `web/public/layers/` and MapLibre sources `inspector` / `farmer`.
- Animation = follow LineString with pitch/bearing (Strava-style), not a new 3D engine.

## Layer 1 — implement (parallel by file)

1. **Type** (`layout.tsx` + `globals.css` font tokens only): Rubik headings, Source Sans 3 body. Keep cream/leaf.
2. **Walk** (`vineyard-map.tsx`): lon/lat + map-click start, snap to walk, play/pause follow camera, walker marker. `prefers-reduced-motion` = jump, no pitch.
3. **Chrome** (`globals.css` rest): tighter type scale, less stacked glass, planner fields. No second accent.

## Layer 2 — review + deploy

Desktop 1280 and phone 390. Redeploy `dementra.md`.
