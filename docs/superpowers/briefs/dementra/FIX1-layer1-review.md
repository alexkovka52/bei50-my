# Fix task — Layer 1 review findings (Grok 4.7 review, verified by the orchestrator)

Read `docs/superpowers/specs/2026-09-29-dementra-frontend.md` and `AGENTS.md`. Python: use
`/Users/cristian/Development/gigahack2026/bei50/processing/.venv/bin/python` with
`PYTHONPATH=$PWD/processing/src` (editable install points at the main checkout). Owned files: exactly the files
named below plus their tests. Do not touch `web/src/app/**` pages, `web/src/components/**`, or `web/src/lib/map/**`.

Fix each item, add/adjust tests, keep everything green (`pytest` in processing; `npm run lint && npm test &&
npm run build` in web after `npm ci`). Do not ssh/deploy; verify scripts with `bash -n`, shellcheck and
`--dry-run`.

1. `web/src/lib/data/types.ts`: widen `block` to `string | null` on `VineyardRow` and the plant/row/inter-row/gap/
   waste layer property types; `ModelMetric.before` → `string | null`; route properties `length_m`,
   `targets_total`, `targets_visited` → `number | null`. Update any code in `web/src/lib/data/**` that relies
   on the old types.
2. `processing/src/siret3/web_bundle.py`: inter-row layer property `cover` must be `"unset"` (not null) when
   missing/unknown, consistent with `summary.cover.unset`; `InterrowProperties.cover` type becomes the union of
   the cover keys.
3. `web_bundle.write_bundle`: remove stale outputs from earlier runs — delete `routes/*.geojson`, `layers/*.geojson`
   and `layers.pmtiles` not produced by this bundle before writing (only inside `out_dir`, only those patterns).
   Test it.
4. `web_bundle` row id allocation (`claim()` / synthetic numbers ~lines 234–263): never reuse a number already
   taken in the same vineyard; test with a vineyard having `R001` plus an unnumbered row id.
5. Regenerate the bundle after the fixes (same command as in `docs/superpowers/briefs/dementra/B-web-bundle.md`
   step 4, source data `/Users/cristian/Development/gigahack2026/bei50/data/gt_32635.geojson`) and commit the
   refreshed `web/public/data/**`.
6. `deploy/nginx/dementra-tiles.conf`: remove `try_files $uri =404;` from the `alias` location (nginx #97 makes it
   look up `/opt/dementra-tiles/tiles/...`). Remove `gzip_types` from the snippet (a server-level `gzip_types`
   replaces the inherited list and would drop CSS/JS compression); keep `gzip on; gzip_proxied any;` only if
   harmless, otherwise drop gzip from the snippet entirely and document in README-deploy.md that JSON gzip should
   be added to the http block's `gzip_types`.
7. `web/scripts/deploy.sh` and `web/scripts/deploy_tiles.sh` `run_remote`: `ssh "${SSH_OPTS[@]}" "$SSH_HOST" "$1"`
   (no `--`). Check every other ssh/rsync invocation for the same mistake.
8. `web/src/app/layout.tsx` manifest href and `web/public/site.webmanifest` icon src: make them basePath-safe
   (use `asset()` for the href; relative icon paths in the manifest).

Commit on your branch (messages end with `Co-Authored-By: Grok 4.7 <noreply@x.ai>`). Report per item what
changed, test results, and the refreshed bundle summary line.
