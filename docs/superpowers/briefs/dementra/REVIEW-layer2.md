I'll review the Layer 2 screens against the spec and the real data, looking only for defects that actually fail. First I'm reading the review guidance and the contract those screens have to meet.The request is a branch review of `feat/dementra-frontend`, scoped to the Layer 2 screens and the real data contract. I'll set up the review and point the reviewer at those defects only.The review procedure needs a shell I don't have here, so I'll read the Layer 2 screens, the spec, and the data files directly and only keep defects I can reproduce from that code.The screens match the design on several headline numbers. Next I’ll check the published JSON for nulls, mismatched counts, and route geometry that would still break those screens.The Layer 2 screens survive the published JSON: null targets, null `disrupted_pct`, and empty lists do not throw. The defects below are numbers, labels, and interactions that are wrong on that data.

## High

### 1. “38% disrupted rows” is not a share of rows
`web/src/components/overview/model.ts:78` and `:108`, also `web/src/components/blocks/BlockFacts.tsx:115` and `web/src/lib/blocks/blocks.ts:87`

`disruptedShare` divides disrupted pieces by regular+disrupted pieces and drops “not assessed”. On `summary.json` that is 477 / (790 + 477) = 38%. The strip labels it **Disrupted rows, 38%**. The same field is the block-table bar and the CSV column `Disrupted rows`.

The published counts make 38% impossible as a share of rows. There are 1,650 rows and 477 disrupted pieces (`counts.rows`, `structure.disrupted`). A row is disrupted only if it has at least one disrupted piece, so at most 477 / 1,650 = 29% of rows can be disrupted. The block page then counts aggregated rows (`BlockRows`), which is a different quantity under the same words.

**Failing scenario:** Overview shows “Disrupted rows 38%”. Reports → Row structure shows Regular 790, Disrupted 477, Not assessed 763. Export CSV writes V01 as `36` under `Disrupted rows` while the on-screen cell is `36%`. Summing that CSV column sums percentages.

**Fix:** Count aggregated rows (`structure === "disrupted"` over `rows.json`) and say “of classified rows” if unset rows stay in the denominator. In the CSV, name the column `Disrupted row pieces (%)` and write `36%`, or export the row count.

### 2. “83% bare soil” does not describe the 21.8 ha next to it
`web/src/components/overview/model.ts:65` and `:102`

`bareSoilPercent` uses only bare + vegetation + mixed: 908 / (908 + 67 + 119) = 83%. That note sits under **Inter-row ground, 21.8 ha**. The cover card on the same page draws the bar over all 1,641 inter-rows, so bare soil is 908 / 1,641 = 55% of the bar (908 bare, 547 not classified). `interrow_ha` is the area of every inter-row, including the unclassified ones.

**Failing scenario:** The strip says the 21.8 ha is “83% bare soil” while the bar beside it is about half bare soil and Reports → Inter-row cover shows 908 bare out of 1,641.

**Fix:** Use the same denominator as the bar, or label it “83% of classified inter-rows”.

## Medium

### 3. Overview calls unassessable ground “Not assessed” and gets 547
`web/src/components/overview/model.ts:122`

`coverSlices` adds `unset + unassessable` and labels the sum “Not assessed”. Published cover is unset 545 and unassessable 2, so the card says **Not assessed, 547**. Reports uses “Not assessed” for unset only (545) and “Unassessable” for the other 2. The overview board’s own legend is 545.

**Failing scenario:** Overview says 547 not assessed; Reports says 545 not assessed and 2 unassessable.

**Fix:** Keep the two classes separate, or label the merged slice so it does not reuse the reports label.

### 4. Status line says the inspector walk visits every issue
`web/src/components/overview/model.ts:57`

The sentence is “One inspector walk visits all of them” for all 1,091 gaps and 83 waste items. `routes/inspector.geojson` has `targets_total: null` and `targets_visited: null`. The bundle turns that into `summary.walks.inspector.stops: 0`, and the walk summary hides a zero stop count. The visit claim stays.

**Failing scenario:** Overview tells the reader the 7.99 km walk covers every gap and waste item. The route file says the visit count was not measured.

**Fix:** Read `targets_visited` / `targets_total`. When either is null, drop “visits all of them” and show only length and time.

### 5. Phone sheet says an empty filter was finished
`web/src/components/walks/PhoneSheet.tsx:53`

If `next` is null, the sheet says “Every task on this walk is checked or skipped.” `next` is also null when the filtered list is empty. The desktop list in that case says “No tasks in this filter.”

**Failing scenario:** V01 is published with `waste: 0`. Open `/walks?walk=farmer&block=V01` on a phone. There are no waste stops, and the sheet says they were all checked or skipped.

**Fix:** If the scoped task list is empty, say there are no stops for this walk and block. Keep the current sentence for when every stop is in the done or skipped set.

### 6. Block rows can be selected from the keyboard with no focus ring
`web/src/components/blocks/BlocksWorkspace.tsx:154`

Each `<tr>` is `tabIndex={0}` and handles Enter and Space, and it sets `outline-none`. The global `:focus-visible` ring in `globals.css` does not show through that utility. `aria-selected` on a native table row is not announced as a selection.

**Failing scenario:** On `/blocks`, tab from the column headers into the body. Focus moves row to row and Enter selects, with no visible focus.

**Fix:** Put the handler on a row button (or `role="button"`) and use `focus-visible:outline` instead of `outline-none`.

### 7. Arrowing between walk tabs drops focus
`web/src/app/walks/page.tsx:43` and `web/src/components/walks/WalkTabs.tsx:19`

Arrow keys call `router.push`, and `WalkStudio` is keyed by `walk:block`, so the tree remounts and the focused tab is destroyed. `aria-controls="walk-panel"` points at an ancestor of the tabs, not a tab panel.

**Failing scenario:** On `/walks` at desktop width, focus Inspector and press ArrowRight. The farmer walk loads and focus returns to the top of the page.

**Fix:** Keep one `WalkStudio` mounted across tab changes (update the route without remounting the tab list), and move focus back to the selected tab after navigation.

### 8. Block CSV download revokes the blob immediately
`web/src/components/blocks/BlocksWorkspace.tsx:39`

`URL.revokeObjectURL` runs synchronously after `link.click()`. The GPX download waits a second before revoking (`WalkSummary.tsx:81`). Safari and Firefox can cancel a blob download that is revoked before the save starts.

**Failing scenario:** On `/blocks` in Safari, Export CSV. The download does not start or the file is empty. The same browser can still download the GPX.

**Fix:** Revoke on the link’s `click` timeout, the same way as the GPX export.

### 9. A failed forecast is cached for 30 minutes
`web/src/app/page.tsx:17` and `web/src/lib/weather/load.ts:11`

A non-OK response, a timeout, or a bad body returns `null`, and the page still renders successfully. `revalidate = 1800` stores that render. The card then says “Weather is unavailable right now” until the next revalidation. A good response is cached for 30 minutes, which matches the comment in `load.ts`.

**Failing scenario:** Open-Meteo times out once during revalidation. Overview keeps the unavailable card for up to half an hour after the API recovers.

**Fix:** Cache only a parsed forecast. On failure, render with `cache: 'no-store'` for that request, or a much shorter TTL, so a null forecast is not the ISR payload.

### 10. Block-filtered GPX keeps the full track and a full-walk filename
`web/src/components/walks/WalkStudio.tsx:122` and `web/src/components/walks/WalkSummary.tsx:63`

The summary distance and the track are the whole route. Waypoints are `scoped` tasks. The file is always `inspector-walk.gpx` or `farmer-walk.gpx`.

**Failing scenario:** Open `/walks?block=V01` and Download GPX. The file is named as the full inspector walk and contains the 7.99 km track, with waypoints only for V01’s gaps.

**Fix:** Name the file with the block id when a block is selected, and either include every stop on the walk or clip the track to that block.

### 11. The model card calls 2,030 row pieces “row lines”
`web/src/components/model/model.ts:75`

`model.dataset.rows` is 2,030, the same number as `summary.counts.row_pieces`. `summary.counts.rows` is 1,650. The card says **2,030 row lines**. Plants, inter-rows, and waste on that card match the survey counts. This one does not match “Rows”.

**Failing scenario:** AI shows 2,030 row lines. Reports → Counts shows Rows 1,650 and Row pieces 2,030.

**Fix:** Label the stat “row pieces”, the same noun as Reports.

## Low

No further low-severity defects. The 547-vs-545 count is filed above as medium because the same label means two different quantities on Overview and Reports.

## Checked and holding

- **Real data loads.** `summary.json` is Sireț3, 82 ha, flown 20 Sep 2026, 30 blocks, 1,650 rows, 2,030 pieces, 13,308 plants, 1,641 inter-rows, 1,091 gaps, 83 waste, 39.11 km of row, canopy 1.0 ha, inter-row 21.78 ha. Top bar and the preview subtitle use those figures (the board’s “145 ha” and “31 blocks” are not what the page prints). Inspector length 7,991.683 m is shown as 7.99 km and about 2 h at 4 km/h. Farmer length 4,293.173 m matches its GeoJSON.
- **Nulls that are in the contract.** Route `targets_total` / `targets_visited` are null and are not dereferenced. `length_m` is used, and a null length falls back to the vertex length. Task headings tolerate a null block, row, or `gap_m`. `disrupted_pct: null` renders “Not measured” and an empty CSV cell. Unknown `/blocks/[id]` is a 404 (`dynamicParams = false`). An unknown `?block=` on walks yields an empty task list on desktop (“No tasks in this filter”) rather than a throw.
- **Model scores.** `before: null` is “Not measured”; a null `now` would be “Pending”. Published strings are shown as stored (`0.35`, `40%`, `2 of 7`). The tile split 223 + 43 + 45 = 311.
- **Weather parsing.** The request is Celsius, km/h, and millimetres for `Europe/Chisinau` at `summary.center`. Incomplete JSON becomes null. Weekday labels come from the `YYYY-MM-DD` calendar date, not the server’s local zone. Frost is `minC <= 2`. The “Weather at Sireț” heading matches the overview board.
- **GPX coordinate order.** GeoJSON `[lon, lat]` is written as `lat`/`lon` attributes, with XML escaping. That path is covered by `gpx.test.mts`.
- **basePath.** Data links, GeoJSON layer URLs, and the MapLibre worker go through `asset()`. In-app links use `next/link`. The blocks `replaceState` uses `window.location.pathname`, which already includes a base path.
- **Hydration and storage.** Walk checkboxes start empty and read `localStorage` in an effect, with try/catch around private mode. Keys are `dementra.walk.done.<taskId>`. Number formatters pin `en-US`. Weather is server-rendered from the fetched payload.
- **Maps and timers.** `MapView` creates one map and calls `map.remove()` on unmount. Walk markers, the media-query listener, and the drag listener are removed. Playback `requestAnimationFrame` is cancelled in the effect cleanup. The preview `resize` listener and the block `ResizeObserver` are cleared when the map fires `remove`. I did not find a leftover map, listener, or frame loop.
- **Server/client split.** Pages load JSON on the server. Map, playback, filters, and print are client components; the preview and walk maps are `dynamic(..., { ssr: false })`.
- **Reports.** Survey, counts, cover, and structure match `summary.json`, including separate unassessable and unset rows. Download hrefs are `asset("/data/...")`. Print CSS hides the rail and the screen header and releases the `min-h-dvh` shell. I did not print it in a browser.
