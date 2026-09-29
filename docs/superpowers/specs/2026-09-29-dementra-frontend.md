# Dementra frontend — shared spec (approved design, 29 Sep 2026)

Product: **Dementra**, aerial vineyard intelligence (live at https://dementra.md). This spec is the contract
every implementation task follows. The approved visual design is in `design/canvas/*.dc.html` (open the HTML
and copy styles faithfully; `/_blob/...` image URLs there map to files in `design/assets/`):

| Board | Route | Notes |
|---|---|---|
| `Main.dc.html` | – | Tokens, type, palette, logo, components |
| `Overview.dc.html` | `/` | Bento overview, 3D preview card |
| `Map3D.dc.html` | `/map` | Flagship: tilted ortho on terrain, forest-glass panels |
| `Walks.dc.html` | `/walks` | Walk summary, issues list, map, playback bar |
| `Blocks.dc.html` | `/blocks`, `/blocks/[id]` | Table + detail panel (detail page reuses the panel) |
| `Model.dc.html` | `/ai` | Pipeline, scores before/now, dataset |
| `Tablet.dc.html` | `/map` at ≤1024px | Bottom sheet inspector |
| `Phone.dc.html` | `/walks` at ≤480px | Walk in progress |
| (no board) | `/reports` | Same shell; measurements table, downloads, printable summary |

Brand name everywhere: "Dementra". Remove every "TRASHOPOLY"/"Trashopoly"/"Sireț3 map" product string and
`public/brand/trashopoly-*`. The dataset/place name "Sireț3" stays as data (farm selector, headings).

## Design tokens (Tailwind v4 `@theme` in `web/src/app/globals.css`)

Colours: `forest #0F2A1D` (ink, map chrome), `moss #375534` (primary), `sage #6B9071`, `lichen #AEC3B0`
(lines), `dew #E3EED4` (app ground), `paper #F8FBF3` (cards), `ink-muted #3E5543` (secondary text on light,
≥4.5:1), `mist #C9D8C0` (secondary text on dark), `line #DDE7D2` (table rules), `budbreak #D6F26B` (lime: ONLY
live/active states: walk in progress, current position, active toggles, selected outline).
Data: `canopy #4E8A4A`, `gap #E09A2D`, `waste #C9432F`, `soil #A9825A`, `mixed #B4B65A`, `vegetation #6B9071`,
`unset #D9E4CD`. Glass: `rgba(15,42,29,0.76)` + `backdrop-filter: blur(16px)` + `1px solid rgba(227,238,212,0.14)`.

Type: **Bricolage Grotesque** (display: page titles 40/700/-1px, big numerals, card titles) and **Onest**
(everything else), both via `next/font/google` with `latin` + `latin-ext` subsets (Sireț needs ș/ț).
Numbers use `font-variant-numeric: tabular-nums`. No all-caps eyebrow labels, no middle-dot meta strings, no mono.

Shape: radii 999 (pills/buttons), 28 (cards), 22–24 (panels), 18 (list items). Touch targets ≥44px.
Icons: `lucide-react` (stroke 1.8). Motion: `motion` package; one orchestrated page-load, responses to user
action only; respect `prefers-reduced-motion`.

App shell (all light pages): 88px left rail (logo mark 36px on top, then Overview, Map, Walks, Blocks, Reports,
AI; active item = forest pill with dew icon+label), top bar per page (title, farm selector pill
"Sireț3 vineyard, 145 ha", "Flown 20 Sep 2026", search 300px, bell, avatar). `/map` is full-bleed dark with
its own floating toolbar (no rail); a back button returns to `/`.

Logo: `design/logo/final/` → copy to `web/public/brand/`: `dementra-mark.svg` (light bg),
`dementra-mark-reversed.svg` (dark bg, lime dot), `dementra-mark-small.svg` (≤24px), app icons and favicons
from `design/logo/final/web-icons/` (favicon.ico, favicon.svg, apple-touch-icon.png, icon-192/512,
maskable-512, site.webmanifest — rename manifest `name` to "Dementra").

## Data contract (`web/public/data/`, produced by `siret3 web-bundle`)

All coordinates WGS84 lon/lat. Every JSON has `"version": 1`.

- `summary.json`
  ```json
  {"version":1,"source":"marcaj-labels|model","generated_at":"ISO","flown_on":"2026-09-20","farm":"Sireț3 vineyard",
   "area_ha":145,"tiles":311,"gsd_m":0.025,"center":[lon,lat],"bbox":[w,s,e,n],"start":[lon,lat],
   "counts":{"blocks":31,"rows":0,"row_pieces":0,"plants":0,"interrows":0,"waste":0,"gaps":0},
   "row_km":0,"canopy_ha":0,"interrow_ha":0,
   "cover":{"bare_soil":0,"vegetation":0,"mixed":0,"unassessable":0,"unset":0},
   "structure":{"regular":0,"disrupted":0,"unassessable":0,"unset":0},
   "walks":{"inspector":{"length_m":0,"stops":0},"farmer":{"length_m":0,"stops":0}}}
  ```
  `counts.blocks` counts only real blocks (≥200 m of rows); smaller fragments are merged into "Other".
- `blocks.json`: `{"version":1,"blocks":[{"id":"V01","rows":138,"row_km":4.71,"plants":2239,"gaps":100,"waste":0,
  "interrow_ha":1.15,"canopy_m2":0,"disrupted_pct":36|null,"cover":{...same keys},"bbox":[w,s,e,n],
  "centroid":[lon,lat],"largest_gaps":[{"row_id":"V01-R034","row":34,"gap_m":12.8,"at":[lon,lat]}]}]}`
  sorted by `row_km` desc; ids V01… are ranks by row length.
- `rows.json`: `{"version":1,"rows":[{"id":"V01-R001","block":"V01","row":1,"length_m":0,"structure":"regular|disrupted|unassessable|null","pieces":1}]}`
- `tasks.json`: `{"version":1,"tasks":[{"id":"GAP-V04-R032-01","kind":"gap|waste","block":"V04|null","row_id":"V04-R032|null",
  "row":32|null,"gap_m":64.0|null,"at":[lon,lat],"priority":1}]}` sorted by priority (gaps by size desc, waste
  clusters ranked by count; priority 1 = most urgent).
- `routes/inspector.geojson`, `routes/farmer.geojson`: FeatureCollection, one LineString, properties
  `length_m`, `role`, `targets_total`, `targets_visited`.
- `layers/{plants,rows,interrows,gaps,waste,blocks,passages,forbidden}.geojson`: simplified geometries;
  properties: plants `{block}`; rows `{id,block,structure}`; interrows `{block,cover}`; gaps `{id,block,row_id,gap_m}`;
  waste `{id,block}`; blocks (outline polygons) `{id,rows,row_km,gaps,waste}`. If tippecanoe is available also
  write `layers.pmtiles` with the same layer names (frontend prefers GeoJSON; PMTiles is optional).
- `model.json`: `{"version":1,"updated_at":"ISO","dataset":{"tiles":311,"plants":13308,"rows":2030,"interrows":1641,"waste":83,
  "split":{"train":223,"val":43,"test":45}},"metrics":[{"key":"plant_f1","label":"Plants found correctly (F1)","before":"0.31","now":null}]}`
  (`now: null` renders as "Pending").

Frontend loads these with `fetch` through a typed client in `web/src/lib/data/` (`types.ts`, `client.ts`)
using the `asset()` base-path helper for every URL.

## Map (MapLibre GL)

- Imagery: self-hosted XYZ WebP at `/tiles/ortho/{z}/{x}/{y}.webp` (z14–z22, bounds in
  `/tiles/ortho/metadata.json`). Configurable by `NEXT_PUBLIC_ORTHO_URL`; fallback to OpenAerialMap
  `https://api.imagery.hotosm.org/raster/collections/openaerialmap/items/683060c4025981aa411253c8/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=visual`.
- Context basemap outside the ortho: Esri World Imagery
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
  (attribution "Esri, Maxar, Earthstar Geographics"), dimmed/desaturated toward forest.
- Terrain: `raster-dem` AWS Terrarium `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
  (`encoding:"terrarium"`, `tileSize:256`, `maxzoom:15`), `exaggeration` default 1.5 (slider 1–3), plus sky/fog in
  forest tones. 3D default pitch 58°, bearing −10°; 2D = pitch 0, terrain off.
- Attribution control must show: imagery CC BY 4.0 3DATA COLLECT / OpenAerialMap; © OpenStreetMap (ODbL) for
  passages; Esri; Mapzen/AWS terrain.
- Keep the local MapLibre worker (`public/maplibre-gl-*.mjs`) setup from the old app.

## Engineering rules

- Next 15 App Router, React 19, TypeScript strict, Tailwind v4. Server components for pages; map and
  interactive widgets are client components, lazy-loaded (`next/dynamic`, `ssr:false`) so `/` paints before the map.
- `npm run lint`, `npm test`, `npm run build` must pass in `web/`. Keep `output: "standalone"` and basePath support.
- No new UI kit; small local components in `web/src/components/ui/`. Allowed new deps: `@radix-ui/*` primitives,
  `recharts` (charts), `pmtiles` (optional), `@playwright/test` (dev).
- Real data only. Never invent numbers; missing values render as "Not measured" or "Pending".
- Do not push, deploy, ssh, or touch files outside your task's scope. Commit on your task branch only.
