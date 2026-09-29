# Fix task — Layer 2 review findings (Grok 4.7 review, verified by the orchestrator)

Read `docs/superpowers/briefs/dementra/L2-common.md`, the spec, and the full review in
`docs/superpowers/briefs/dementra/REVIEW-layer2.md` (file:line references there). The polish task (I) has
already merged, so re-locate code if lines moved. You own `web/src/**` for this task (not package.json,
not web/public/data, not processing).

Fix all 11 findings:
1. Disrupted share: compute from aggregated rows in `rows.json` (rows whose `structure` is "disrupted" over
   rows with a known structure), label "Disrupted rows" with that share; keep the per-block bar consistent
   (per-block row counts from rows.json); CSV column `Disrupted rows (%)` with a `%`-free number or the count.
2. "Bare soil" note under Inter-row ground: same denominator as the cover bar (all inter-rows), or label
   "<x>% of classified inter-rows". Pick one and use it everywhere.
3. Keep "Not assessed" (unset) and "Unassessable" separate on the overview cover card, like /reports.
4. Walk copy uses `targets_visited`/`targets_total` (see brief I item 9) — verify it after I's changes.
5. Phone sheet: empty scoped task list says there are no stops for this walk/block.
6. Blocks table rows: visible focus ring (`focus-visible:outline`), selection via a real button or
   role="button" with `aria-pressed`, no `outline-none`.
7. Walk tabs: arrow-key switching must not remount the tab list or lose focus; `aria-controls` points to a real
   tabpanel.
8. Blocks CSV: revoke the object URL after a timeout like the GPX export.
9. Weather: do not cache a failed forecast for 30 min (fetch with no-store / short revalidate on failure; only
   the successful payload gets the 30-min cache).
10. GPX when a block is selected: filename includes the block id; state in the UI that the track is the whole walk.
11. AI dataset card: "row pieces", not "row lines".
Add node tests for the pure logic you change. `npm run lint`, `npm test`, `npm run build` pass. Commit
(`Co-Authored-By: Grok 4.7 <noreply@x.ai>`). Report per finding.
