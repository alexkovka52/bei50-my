# Task H — Blocks, block detail, reports and AI pages (Layer 2)

Read `docs/superpowers/briefs/dementra/L2-common.md` first. Boards: `design/canvas/Blocks.dc.html`,
`design/canvas/Model.dc.html`. `/reports` has no board: build it in the same system.

Owned files: `web/src/app/blocks/**`, `web/src/app/reports/**`, `web/src/app/ai/**`,
`web/src/components/blocks/**`, `web/src/components/reports/**`, `web/src/components/model/**` (new),
`web/src/lib/blocks/**` (new). No new dependencies (build bars with CSS like the boards).

## Build
- `/blocks`: header "Blocks" + "<n> blocks, longest rows first", a filter input and "Export CSV" (client-side
  CSV of all blocks). A real `<table>` like the board (Block, Rows, Row length, Plants, Disrupted rows bar,
  Gaps, Waste, Inter-row) with sortable column headers (buttons with `aria-sort`), all 30 blocks, row click
  or Enter selects the block and shows the right detail panel (desktop) with: a small non-interactive
  `MapView` (2D, dataLayers blocks + gaps + waste) framed on the block's bbox with `setSelectedBlock`, stats
  (plants, gaps, waste), inter-row cover bar, largest gaps list, buttons "Show on map" (`/map?block=ID`) and
  "Walk this block" (`/walks?block=ID`). Selection in the URL (`?selected=V03`).
- `/blocks/[id]`: full page for one block (same content as the panel, larger map, plus the block's rows list
  from `rows.json` with length and structure, disrupted rows highlighted), `generateStaticParams` from
  blocks.json, `notFound()` for unknown ids, breadcrumb back to `/blocks`.
- `/reports`: summary measurements (area, row length, canopy, inter-row, counts, cover and structure
  counts) in tables; downloads: every file in `web/public/data` (summary, blocks, rows, tasks, routes,
  each layer GeoJSON) with sizes; a "Print summary" button using a print stylesheet (hide the rail, black on
  white, one page).
- `/ai`: the Model board: the six pipeline steps (a real sequence, numbered), the scores table from
  `model.json` (label, Before, Now; null → "Pending"), dataset card (counts and the train/tune/score split
  bar from `model.json.dataset`), the two explanatory lines from the board.
- Responsive: table scrolls horizontally inside its card on narrow screens; detail panel becomes a
  section below the table ≤1200px.
- Pure logic (sorting, CSV export, filtering) in `web/src/lib/blocks/` with node tests.
