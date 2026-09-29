# Task E — 3D map workspace `/map` (Layer 2, the flagship screen)

Read `docs/superpowers/briefs/dementra/L2-common.md` first. Boards: `design/canvas/Map3D.dc.html` (desktop)
and `design/canvas/Tablet.dc.html` (≤1024px).

Owned files: `web/src/app/map/**`, `web/src/components/workspace/**` (new), `web/src/lib/workspace/**` (new).

## Build
- Full-bleed forest page (no rail) with `MapView` (mode 3d) centred on `summary.center`, fitted to
  `summary.bbox` on load. Show the drone imagery, terrain, and the data layers.
- Floating glass UI exactly like the board:
  - Top-centre toolbar: reversed brand mark linking to `/`, "Sireț3 vineyard" (from summary.farm), a
    search box that finds a block (V01…) or a row (V04-R032 or "V04 row 32") from `blocks.json`/`rows.json`
    and flies to it, a 2D/3D segmented control (uses `setMode`), "Flown 20 Sep".
  - Left "Layers" panel: toggles with counts for Plants, Rows, Inter-row cover, Gaps, Waste, Paths and
    forbidden zones (uses `setDataLayerVisible`; counts from summary), a terrain-height slider (1–3×, live
    `map.setTerrain` exaggeration) and a drone-imagery opacity slider (`raster-opacity` on layer `ortho`).
    Collapsible; state persisted in the URL (`?layers=`) and localStorage.
  - Right inspector: click a block (layer `blocks-fill`) → block stats (rows, row length, plants,
    inter-row ha, disrupted bar, largest gaps list with fly-to, waste count) and buttons "Walk this block"
    (link `/walks?block=V02`) and "Block details" (`/blocks/V02`). Click a gap/waste point → a small card with
    its task (gap size, row) and a "Show on walk" link. `setSelectedBlock` highlights the selection. URL
    state: `?block=V02&row=V02-R076`; opening `/map?block=V02` flies to that block.
  - Hover: pointer cursor + a small label chip over rows/gaps (row id, structure / gap size).
  - Bottom-left minimap (a second small non-interactive `MapView` in 2D without terrain, showing a
    rectangle of the main view's bounds), bottom-centre legend, bottom-right compass (reset north, shows
    bearing) and zoom buttons.
- Tablet (≤1024px): toolbar compresses to back, search, layers button (opens the layers panel as a sheet)
  and 2D/3D; the inspector becomes the bottom sheet from the Tablet board. Phone: same as tablet, sheet
  full width.
- Keyboard: the map region is focusable; +/− zoom, arrow keys pan (MapLibre defaults are fine); every panel
  control is reachable; Escape closes the inspector.
- Pure helpers (search parsing, URL state encode/decode) go in `web/src/lib/workspace/` with node tests.
