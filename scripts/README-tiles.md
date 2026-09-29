# Orthomosaic map tiles

XYZ WebP tiles for the Sireț3 orthomosaic, served by the Dementra map at
`/tiles/ortho/{z}/{x}/{y}.webp`. The builder is `scripts/build_ortho_tiles.sh`.
Tiles are generated locally and are not committed (`dist/` is gitignored).

## Rebuild

GDAL 3.1 or newer, with `gdalinfo`, `gdalwarp`, and `gdal2tiles` (or
`gdal2tiles.py`). On this Mac:

```bash
brew install gdal
bash scripts/build_ortho_tiles.sh
```

The script waits up to 20 minutes for `gdalinfo` to appear on `PATH`. If GDAL
is still missing, or older than 3.1, it prints `brew install gdal` and exits 2.

| Variable | Default | Meaning |
| --- | --- | --- |
| `SRC` | `/Users/cristian/Development/gigahack2026/bei50/data/challenge/04_source/siret3_source_orthomosaic_EPSG4326.tif` | Source orthomosaic (EPSG:4326, about 3.52 cm/px, gitignored) |
| `OUT` | `/Users/cristian/Development/gigahack2026/bei50/dist/tiles/ortho` | Tile directory on the main checkout |
| `ZOOMS` | `14-21` | Zoom range passed to `gdal2tiles -z` |
| `PROCS` | CPU count minus 2 (at least 1) | `gdal2tiles --processes` |

Re-running overwrites the warp and the tiles in place.

What it does:

1. `gdalwarp` writes an EPSG:3857 VRT (`-r cubic`, `-dstalpha`). The source COG
   carries a per-dataset mask (about 44% of pixels are valid). Masked border
   pixels are white JPEG fill, so `-dstalpha` is what makes those borders
   transparent. Setting `-srcnodata "0 0 0"` as well makes GDAL ignore that
   mask and keep the white border opaque.
2. `gdal2tiles --xyz -z $ZOOMS -r average -w none --tiledriver=WEBP
   --webp-quality=82 --processes=$PROCS --exclude` writes 256×256 WebP tiles
   and skips fully transparent ones. GDAL 3.13 ignores `--processes` on its
   non-legacy path (the value stays 1), so the script calls that entry point
   with the requested process count applied.
3. Average resampling writes a fully opaque alpha of 255, and libwebp then
   drops that chunk, so interior tiles come out RGB. The script rewrites
   those as lossless WebP with the same colour samples and one corner alpha
   of 254, which keeps the alpha plane. Edge tiles that already have a
   partial alpha chunk stay lossy WebP quality 82. Both open as 256×256 RGBA.
4. `$OUT/metadata.json` records bounds from `gdalinfo -json` on the source,
   plus format, scheme, zoom range, centre (zoom 17), and the imagery credit.

## Zoom range

z21 is about 5.1 cm/px at 47.12° N (Web Mercator equator resolution
`156543 m/px / 2^21`, times `cos(latitude)`). The source ground sample distance
is 3.52 cm/px, so z21 is the finest level that does not oversample. z22 would
be about 2.5 cm/px and is not built.

## URL layout

```
/tiles/ortho/{z}/{x}/{y}.webp
/tiles/ortho/metadata.json
```

`metadata.json` looks like:

```json
{"version":1,"format":"webp","scheme":"xyz","minzoom":14,"maxzoom":21,"bounds":[28.7009351,47.1135363,28.7231667,47.1312467],"center":[28.7120509,47.1223915,17],"attribution":"Imagery CC BY 4.0 3DATA COLLECT / OpenAerialMap"}
```

`bounds` is `[west, south, east, north]` in WGS84 degrees. The MapLibre style
reads this file and the tile URL above. `NEXT_PUBLIC_ORTHO_URL` can point
somewhere else; otherwise the app falls back to the OpenAerialMap tile API.

Credit line, also stored in `attribution`: Imagery CC BY 4.0 3DATA COLLECT / OpenAerialMap.

## Sizes

From the build on this machine (2026-09-29, GDAL 3.13.3, 12 processes,
134 seconds). The script prints the same table (`zoom`, tile count,
`du -sh`) every time it runs. Of 12,012 tiles, 10,787 interior tiles are
lossless WebP so they stay RGBA; the other 1,225 are lossy quality 82.
That rewrite is why the tree is 905M.

| Zoom | Tiles | Size |
| --- | ---: | ---: |
| 14 | 5 | 32K |
| 15 | 10 | 84K |
| 16 | 19 | 416K |
| 17 | 53 | 2.1M |
| 18 | 172 | 10M |
| 19 | 609 | 43M |
| 20 | 2287 | 177M |
| 21 | 8857 | 673M |
| **Total** | **12012** | **905M** |

## Deploy

`web/scripts/deploy_tiles.sh` (task D) uploads `dist/tiles/ortho/` to the
server. This script only builds tiles. It does not deploy, push, or copy them
off the machine.
