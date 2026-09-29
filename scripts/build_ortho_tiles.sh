#!/usr/bin/env bash
# Build XYZ WebP tiles for the Sireț3 orthomosaic (Dementra map, z14–z21).
# Safe to re-run: the warp VRT is rewritten and gdal2tiles overwrites tiles in place.
set -euo pipefail

SRC="${SRC:-/Users/cristian/Development/gigahack2026/bei50/data/challenge/04_source/siret3_source_orthomosaic_EPSG4326.tif}"
OUT="${OUT:-/Users/cristian/Development/gigahack2026/bei50/dist/tiles/ortho}"
ZOOMS="${ZOOMS:-14-21}"

if [[ -z "${PROCS:-}" ]]; then
  if command -v sysctl >/dev/null 2>&1; then
    ncpu=$(sysctl -n hw.ncpu)
  elif command -v nproc >/dev/null 2>&1; then
    ncpu=$(nproc)
  else
    ncpu=2
  fi
  if [[ "$ncpu" -gt 2 ]]; then
    PROCS=$((ncpu - 2))
  else
    PROCS=1
  fi
fi
if [[ "$PROCS" -lt 1 ]]; then
  PROCS=1
fi

die_need_gdal() {
  echo "brew install gdal" >&2
  exit 2
}

# Homebrew GDAL may still be installing. Wait up to 20 minutes for gdalinfo.
deadline=$((SECONDS + 1200))
while ! command -v gdalinfo >/dev/null 2>&1; do
  if [[ "$SECONDS" -ge "$deadline" ]]; then
    die_need_gdal
  fi
  echo "gdalinfo not on PATH yet; retrying (brew install gdal)" >&2
  sleep 30
done

command -v gdalwarp >/dev/null 2>&1 || die_need_gdal

if command -v gdal2tiles >/dev/null 2>&1; then
  GDAL2TILES=(gdal2tiles)
elif command -v gdal2tiles.py >/dev/null 2>&1; then
  GDAL2TILES=(gdal2tiles.py)
else
  die_need_gdal
fi

ver=$(gdalinfo --version | sed -n 's/.*GDAL \([0-9][0-9]*\)\.\([0-9][0-9]*\).*/\1 \2/p' | head -1)
major=${ver%% *}
minor=${ver#* }
if [[ -z "$major" || -z "$minor" ]]; then
  echo "could not parse GDAL version: $(gdalinfo --version)" >&2
  die_need_gdal
fi
if [[ "$major" -lt 3 || ( "$major" -eq 3 && "$minor" -lt 1 ) ]]; then
  echo "GDAL $(gdalinfo --version) is older than 3.1" >&2
  die_need_gdal
fi

if [[ ! -f "$SRC" ]]; then
  echo "source GeoTIFF not found: $SRC" >&2
  exit 1
fi

if [[ "$ZOOMS" =~ ^([0-9]+)-([0-9]+)$ ]]; then
  MINZOOM=${BASH_REMATCH[1]}
  MAXZOOM=${BASH_REMATCH[2]}
elif [[ "$ZOOMS" =~ ^([0-9]+)$ ]]; then
  MINZOOM=${BASH_REMATCH[1]}
  MAXZOOM=${BASH_REMATCH[1]}
else
  echo "ZOOMS must look like 14-21 or 17 (got: $ZOOMS)" >&2
  exit 1
fi
if [[ "$MINZOOM" -gt "$MAXZOOM" ]]; then
  echo "ZOOMS min is greater than max: $ZOOMS" >&2
  exit 1
fi

CENTER_Z=17
if [[ "$CENTER_Z" -lt "$MINZOOM" ]]; then
  CENTER_Z=$MINZOOM
fi
if [[ "$CENTER_Z" -gt "$MAXZOOM" ]]; then
  CENTER_Z=$MAXZOOM
fi

export PYTHONUNBUFFERED=1

started=$(date +%s)
echo "gdal: $(gdalinfo --version)"
echo "src: $SRC"
echo "out: $OUT"
echo "zooms: $ZOOMS"
echo "processes: $PROCS"

mkdir -p "$OUT"
work=$(mktemp -d "${TMPDIR:-/tmp}/build-ortho-tiles.XXXXXX")
cleanup() {
  rm -rf "$work"
}
trap cleanup EXIT

# The COG has a per-dataset mask. Border pixels are white fill, not 0,0,0.
# -dstalpha copies that mask into alpha. -srcnodata would replace the mask
# and leave the white border opaque, so it is not set.
vrt="$work/ortho_3857.vrt"
gdalwarp \
  -overwrite \
  -of VRT \
  -t_srs EPSG:3857 \
  -r cubic \
  -dstalpha \
  -wo NUM_THREADS=1 \
  "$SRC" \
  "$vrt"

# Same arguments as `gdal2tiles --xyz -z $ZOOMS -r average -w none
# --tiledriver=WEBP --webp-quality=82 --processes=$PROCS --exclude`.
# GDAL 3.13's non-legacy path ignores --processes (it reads a different
# default stuck at 1) and writes fully opaque WebP tiles without an alpha
# band. MapLibre needs RGBA, including on the vineyard interior, so the
# entry point is called with those two corrected.
PROCS="$PROCS" ZOOMS="$ZOOMS" VRT="$vrt" OUT="$OUT" python3 - <<'PY'
import os
import sys

from osgeo import gdal
import osgeo_utils.gdal2tiles as gdal2tiles

real_process_args = gdal2tiles.process_args


def process_args(argv, called_from_main=False):
    infile, folder, options, tms_map = real_process_args(
        argv, called_from_main=called_from_main
    )
    requested = getattr(options, "nb_processes", None)
    if requested:
        options.processes = requested
    return infile, folder, options, tms_map


gdal2tiles.process_args = process_args

real_tile = gdal.alg.raster.tile


def tile(**kwargs):
    kwargs["add_alpha"] = True
    return real_tile(**kwargs)


gdal.alg.raster.tile = tile

sys.argv = [
    "gdal2tiles",
    "--xyz",
    "-z",
    os.environ["ZOOMS"],
    "-r",
    "average",
    "-w",
    "none",
    "--tiledriver=WEBP",
    "--webp-quality=82",
    "--processes",
    os.environ["PROCS"],
    "--exclude",
    os.environ["VRT"],
    os.environ["OUT"],
]
raise SystemExit(gdal2tiles.main(sys.argv, called_from_main=True))
PY

# Average resampling writes a fully opaque alpha of 255, and libwebp then
# drops that chunk, so interior tiles come out RGB. Rewrite those as lossless
# RGBA with the same colour samples. One corner alpha of 254 keeps the chunk;
# the other pixels stay 255.
OUT="$OUT" PROCS="$PROCS" python3 - <<'PY'
import multiprocessing as mp
import os
from pathlib import Path

out = Path(os.environ["OUT"])
procs = max(1, int(os.environ["PROCS"]))


def promote(path):
    from osgeo import gdal

    gdal.UseExceptions()
    path = str(path)
    with open(path, "rb") as handle:
        header = handle.read(21)
    if len(header) >= 21 and header[12:16] == b"VP8X" and header[20] & 0x10:
        return 0
    src = gdal.Open(path)
    width, height = src.RasterXSize, src.RasterYSize
    mem = gdal.GetDriverByName("MEM").Create("", width, height, 4, gdal.GDT_Byte)
    for index, color in (
        (1, gdal.GCI_RedBand),
        (2, gdal.GCI_GreenBand),
        (3, gdal.GCI_BlueBand),
    ):
        band = mem.GetRasterBand(index)
        band.WriteRaster(0, 0, width, height, src.GetRasterBand(index).ReadRaster())
        band.SetColorInterpretation(color)
    alpha = mem.GetRasterBand(4)
    alpha.Fill(255)
    alpha.WriteRaster(0, 0, 1, 1, b"\xfe")
    alpha.SetColorInterpretation(gdal.GCI_AlphaBand)
    src = None
    tmp = path + ".rgba.tmp.webp"
    gdal.GetDriverByName("WEBP").CreateCopy(tmp, mem, options=["LOSSLESS=YES"])
    mem = None
    os.replace(tmp, path)
    return 1


paths = [str(path) for path in out.rglob("*.webp")]
if procs == 1 or len(paths) < 2:
    rewritten = sum(promote(path) for path in paths)
else:
    try:
        mp.set_start_method("fork")
    except RuntimeError:
        pass
    with mp.Pool(procs) as pool:
        rewritten = sum(pool.map(promote, paths, chunksize=16))
print(f"rgba_rewrite {rewritten} of {len(paths)}")
PY

SRC="$SRC" OUT="$OUT" MINZOOM="$MINZOOM" MAXZOOM="$MAXZOOM" CENTER_Z="$CENTER_Z" \
  python3 - <<'PY'
import json
import os
import subprocess

src = os.environ["SRC"]
out = os.environ["OUT"]
info = json.loads(subprocess.check_output(["gdalinfo", "-json", src], text=True))
ring = info["wgs84Extent"]["coordinates"][0]
lons = [point[0] for point in ring]
lats = [point[1] for point in ring]
west, east = min(lons), max(lons)
south, north = min(lats), max(lats)
meta = {
    "version": 1,
    "format": "webp",
    "scheme": "xyz",
    "minzoom": int(os.environ["MINZOOM"]),
    "maxzoom": int(os.environ["MAXZOOM"]),
    "bounds": [west, south, east, north],
    "center": [(west + east) / 2.0, (south + north) / 2.0, int(os.environ["CENTER_Z"])],
    "attribution": "Imagery CC BY 4.0 3DATA COLLECT / OpenAerialMap",
}
path = os.path.join(out, "metadata.json")
with open(path, "w", encoding="utf-8") as handle:
    json.dump(meta, handle, separators=(",", ":"))
    handle.write("\n")
print(json.dumps(meta, separators=(",", ":")))
PY

echo "zoom tiles size"
total=0
zooms=$(find "$OUT" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | grep -E '^[0-9]+$' | sort -n || true)
for z in $zooms; do
  count=$(find "$OUT/$z" -type f -name '*.webp' | wc -l | tr -d ' ')
  size=$(du -sh "$OUT/$z" | awk '{print $1}')
  printf '%4s %8s %8s\n' "$z" "$count" "$size"
  total=$((total + count))
done
echo "total_tiles $total"
du -sh "$OUT"
elapsed=$(( $(date +%s) - started ))
echo "elapsed_s $elapsed"
