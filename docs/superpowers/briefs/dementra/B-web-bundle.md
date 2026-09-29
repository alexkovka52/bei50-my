# Task B — `siret3 web-bundle`: the frontend data contract (Layer 1)

Read first: `docs/superpowers/specs/2026-09-29-dementra-frontend.md` (section "Data contract" is your
spec), `AGENTS.md`, and these modules in `processing/src/siret3/`: `assemble.py`, `inspect.py`,
`marcaj.py` (`to_wgs84_collection`, `write_web_layers`, `_simplify_fc`), `measurements.py`, `cli.py`
(`_items_from_collection`, `_cmd_assemble`), `crs.py`. Python env: you are in a git worktree without its own venv. Use the main checkout's interpreter
`/Users/cristian/Development/gigahack2026/bei50/processing/.venv/bin/python` and ALWAYS put your worktree's source first:
`export PYTHONPATH=$PWD/processing/src` (the venv has an editable install pointing at the main checkout, so
without this you would run the wrong code). Tests: `cd processing && PYTHONPATH=src /Users/cristian/Development/gigahack2026/bei50/processing/.venv/bin/python -m pytest -q`
(all must stay green). CLI: `PYTHONPATH=$PWD/processing/src /Users/cristian/Development/gigahack2026/bei50/processing/.venv/bin/python -m siret3.cli web-bundle …`.

Scope: `processing/src/siret3/web_bundle.py` (new), `processing/src/siret3/cli.py` (new subcommand only),
`processing/tests/test_web_bundle.py` (new), and the generated `web/public/data/**`. Nothing else.

## Deliver

1. `web_bundle.py` with a pure function `build_bundle(items, *, routes, passages, forbidden, baseline, now,
   source, flown_on) -> dict[str, object]` (relative path → JSON-serialisable object) and a writer
   `write_bundle(bundle, out_dir)` (writes compact JSON, `ensure_ascii=False`, creates `routes/` and `layers/`).
   - `items`: `ProjectedPoly` list in EPSG:32635 (kinds `vineyard`, `row`, `interrow_area`, `waste`).
   - Optional `assemble=True` path in the CLI runs `assemble.assemble(items, passages=...)` first (the
     ground-truth layer has unreliable annotator IDs, so the CLI will pass `--assemble`).
   - Gaps: `inspect.inspections_from_canopies(items)` (≥5 m gaps along rows).
   - Blocks: rank by total row length; blocks with ≥200 m of rows become `V01…` in rank order; all
     feature ids (`vineyard_id`, `row_id` → `V04-R032`, keeping the row number from assemble) are remapped
     consistently; features of smaller fragments get `block: null` and are excluded from `blocks.json` but
     still appear in layers/tasks. `counts.blocks` = number of real blocks.
   - Per block: rows (distinct row ids), row_km, plants, gaps, waste, interrow_ha, canopy_m2,
     `disrupted_pct` = disrupted / (regular + disrupted) pieces (null if none assessed), cover counts,
     bbox/centroid in WGS84, `largest_gaps` top 3.
   - `tasks.json`: every gap (priority by `gap_m` desc) and every waste item; waste gets priority by the
     count of waste in its block (desc), interleaved after gaps ≥ 20 m. Stable ids
     `GAP-<row_id>-<nn>` / `WASTE-<block or X>-<nnn>`.
   - Layers GeoJSON in WGS84 with coordinates rounded to 7 decimals and simplified (plants 0.03 m,
     rows none, interrows 0.15 m, blocks outlines = convex-ish footprint of each block: union of row buffers
     1.5 m, simplified 0.5 m). `passages`/`forbidden` from the official `data/challenge/02_route/*.geojson`.
   - Routes: read inspector/farmer route GeoJSON (EPSG:32635 or WGS84; use `to_wgs84_collection`), keep
     one LineString, properties `length_m`, `role`, `targets_total`, `targets_visited` (null when absent).
   - `summary.json` exactly per spec (`area_ha` = 145 from the official brief unless a study-area polygon
     is given: `data/challenge/02_route/study_area.geojson` area in ha, rounded).
   - `model.json`: metrics from a baseline eval JSON (`siret3 eval --out`) and an optional "now" eval JSON:
     `plant_f1` (plants.f1), `waste_found` ("tp of gt"), `rows_f1` (rows.f1), `structure_acc`
     (rows.structure_acc, as %), `cover_acc` (interrows.cover_acc, as %). Missing values → `null`.
     Dataset block: tiles 311, counts from the items, split counts from `data/splits/siret3_split.json`.
   - If `tippecanoe` is on PATH, also build `layers.pmtiles` from the layer GeoJSONs (layer names = file
     stems, z12–z20); otherwise skip silently and say so in the CLI output.
2. CLI: `siret3 web-bundle --layers <32635 geojson> [--assemble] [--inspector route.geojson]
   [--farmer route_farmer.geojson] [--passages …] [--forbidden …] [--baseline eval.json] [--now eval.json]
   [--source marcaj-labels|model] [--flown-on 2026-09-20] --out-dir web/public/data`
   (defaults for passages/forbidden = official files when present). Print a one-line summary.
3. Tests (`test_web_bundle.py`, synthetic tiny data, no real tiles): block ranking + id remap, fragment
   exclusion, disrupted_pct, tasks ordering, WGS84 output ranges, model metrics mapping incl. nulls,
   routes property passthrough.
4. Generate the real bundle and commit it:
   ```bash
   PYTHONPATH=$PWD/processing/src /Users/cristian/Development/gigahack2026/bei50/processing/.venv/bin/python -m siret3.cli web-bundle --layers /Users/cristian/Development/gigahack2026/bei50/data/gt_32635.geojson --assemble --source marcaj-labels \
     --inspector route.geojson --farmer route_farmer.geojson --baseline data/eval/baseline_test.json \
     --flown-on 2026-09-20 --out-dir web/public/data
   ```
   Report the file sizes. Keep `layers/plants.geojson` under 6 MB (increase simplification or drop
   properties if needed). Expected ballpark from the ground truth: ~31 blocks, ~13.3k plants, ~83 waste,
   ~1.1k gaps, ~39 km of rows.

## Rules
- Commit on your current branch (messages end with `Co-Authored-By: Grok 4.7 <noreply@x.ai>`).
  Do not push, deploy or ssh. Report: files, commands + results (pytest summary line), sizes, open issues.
