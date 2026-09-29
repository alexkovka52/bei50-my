# Task C — self-hosted orthomosaic map tiles (Layer 1)

Read first: `docs/superpowers/specs/2026-09-29-dementra-frontend.md` (section "Map"), `AGENTS.md`,
`docs/siret3-dataset.md`.

Scope: `scripts/build_ortho_tiles.sh` (new), `scripts/README-tiles.md` (new). Output goes to
`dist/tiles/ortho/` which is gitignored — never commit tiles.

## Deliver

1. `scripts/build_ortho_tiles.sh` (bash, `set -euo pipefail`, idempotent, safe to re-run):
   - Input: `/Users/cristian/Development/gigahack2026/bei50/data/challenge/04_source/siret3_source_orthomosaic_EPSG4326.tif` (absolute: it is gitignored, so it is not in your worktree) (658 MB, EPSG:4326,
     ~3.5 cm/px). Override with `SRC=`; output `OUT=/Users/cristian/Development/gigahack2026/bei50/dist/tiles/ortho` (absolute, the main checkout); `ZOOMS=14-21` default
     (z21 ≈ 5.1 cm/px at this latitude; z22 would only oversample); `PROCS` default = CPU count − 2.
   - Requires GDAL ≥ 3.1 (`gdal2tiles.py` or `gdal2tiles`, `gdalwarp`, `gdalinfo`). If missing, print
     `brew install gdal` and exit 2. (Homebrew GDAL is being installed on this Mac; if it is still not on
     PATH, wait and retry for up to 20 minutes: `until command -v gdalinfo; do sleep 30; done` with a timeout.)
   - Steps: `gdalwarp` to an EPSG:3857 VRT (`-r cubic`, keep alpha / set nodata so black borders become
     transparent: the source has black no-data corners, treat RGB 0,0,0 as nodata via `-srcnodata "0 0 0"`
     or `-dstalpha`), then `gdal2tiles --xyz -z $ZOOMS -r average -w none --tiledriver=WEBP
     --webp-quality=82 --processes=$PROCS --exclude` (exclude fully transparent tiles).
   - Write `$OUT/metadata.json`: `{"version":1,"format":"webp","scheme":"xyz","minzoom":14,"maxzoom":21,
     "bounds":[w,s,e,n],"center":[lon,lat,17],"attribution":"Imagery CC BY 4.0 3DATA COLLECT / OpenAerialMap"}`
     (bounds from `gdalinfo -json` of the source).
   - Print a size report: tile count per zoom and total size (`du -sh`).
2. Run it for real on this machine (it may take a while; run it, don't just write it). Verify a few tiles
   exist at z17 and z21 over the vineyard centre (lon 28.707, lat 47.123) and open one with
   `python3 -c "from PIL import Image; print(Image.open(p).size, Image.open(p).mode)"` → (256, 256) RGBA.
3. `scripts/README-tiles.md`: how to rebuild, sizes, URL layout `/tiles/ortho/{z}/{x}/{y}.webp`, and that
   `web/scripts/deploy_tiles.sh` (task D) uploads them.

## Rules
- Commit only the script and README on your current branch (messages end with
  `Co-Authored-By: Grok 4.7 <noreply@x.ai>`). Do not push, deploy or ssh.
- Report: commands run, runtime, tile counts/sizes per zoom, metadata.json content, any warnings.
