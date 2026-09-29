# Task F — Overview `/` (Layer 2)

Read `docs/superpowers/briefs/dementra/L2-common.md` first. Board: `design/canvas/Overview.dc.html`.

Owned files: `web/src/app/page.tsx`, `web/src/components/overview/**` (new), `web/src/lib/weather/**` (new).

## Build (match the board's bento layout; real data from summary/blocks/tasks)
- Status card: one sentence built from data: "<gaps> planting gaps and <waste> waste items are waiting
  across <blocks> blocks." plus "One inspector walk visits all of them: <km>, about <duration>." (duration at
  4 km/h via `formatDuration`), buttons "Start inspector walk" (`/walks`) and "See all tasks" (`/walks#tasks`).
- Numbers strip (hairline dividers, not cards): Rows (row_km, "<row_pieces> row pieces"), Plants
  (count, "<canopy_ha> of canopy"), Inter-row ground (interrow_ha, "<bare %> bare soil" computed from cover
  counts over assessed), Disrupted rows (disrupted / (regular+disrupted) %, "a gap of 5 m or more").
- Weather card: LIVE from Open-Meteo for `summary.center`
  (`https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe%2FChisinau&forecast_days=7`),
  fetched on the server with `next: { revalidate: 1800 }` (the page becomes ISR). Show current temperature
  with an icon for the WMO code, a 7-day min/max bar strip (weekday labels), and one generated sentence:
  lowest night temperature and day ("Cold nights ahead, lowest 5.0 °C on Saturday." only if min < 8 °C;
  otherwise "Mild nights, lowest X °C."), dry days until the first day with ≥1 mm, wind. Frost warning in
  gap-amber when any min ≤ 2 °C. On fetch failure show "Weather is unavailable right now." — never fake data.
  Pure logic (sentence builder, WMO code → label/icon) in `web/src/lib/weather/` with node tests.
- Inter-row cover card: stacked bar + legend with counts (bare/mixed/vegetation/not assessed) and a line
  "<mixed+vegetation> inter-rows carry grass worth mowing before harvest traffic."
- "Next on the walk": top 3 tasks from `tasks.json` as cards, link "All <n> tasks" to `/walks#tasks`.
- Right column: the dark 3D preview card: a non-interactive `MapView` (3d, data layers: blocks, gaps,
  waste only) framed on the block with the most gaps, with the fog gradient, title "Sireț3 in 3D",
  subtitle "<area_ha> ha, <tiles> tiles at 2.5 cm", an "Open map" button (`/map?block=<id>`), a glass
  chip for that block (rows, km, disrupted count, waste), and the legend chips. Before the map loads, show
  a static forest placeholder of the same size (no layout shift).
- Responsive: ≤1200px the map card moves below; ≤700px single column, KPI strip 2×2.
