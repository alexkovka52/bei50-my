#!/usr/bin/env bash
# Upload dist/tiles/ortho/ to inventica-crm:/opt/dementra-tiles/ortho/.
# --delete is the only way remote files are removed. --dry-run does not connect.
set -euo pipefail

SSH_HOST=inventica-crm
REMOTE_TILES=/opt/dementra-tiles/ortho
PUBLIC_PREFIX=https://dementra.md/tiles/ortho
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20)
RSYNC_RSH="ssh -o BatchMode=yes -o ConnectTimeout=20"

DRY_RUN=0
DELETE=0

usage() {
  cat <<'EOF'
Usage: web/scripts/deploy_tiles.sh [--dry-run] [--delete]

  rsync dist/tiles/ortho/ to inventica-crm:/opt/dementra-tiles/ortho/
  then request the metadata.json centre tile via https://dementra.md/tiles/ortho/...

  --dry-run   print the rsync and the curl; do not connect
  --delete    pass --delete to rsync (off unless you set this)
  TILES_DIR   override the local ortho directory (default: <repo>/dist/tiles/ortho)
EOF
}

die() {
  echo "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --delete) DELETE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
  shift
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TILES="${TILES_DIR:-$REPO_ROOT/dist/tiles/ortho}"

case "$REMOTE_TILES" in
  /opt/dementra-tiles/ortho) ;;
  *) die "refusing unexpected remote path $REMOTE_TILES" ;;
esac

run_remote() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[dry-run] ssh'
    local opt
    for opt in "${SSH_OPTS[@]}"; do
      printf ' %q' "$opt"
    done
    printf ' %q %s\n' "$SSH_HOST" "$1"
    return 0
  fi
  # Command text is built on this machine; client-side expansion is intentional.
  # shellcheck disable=SC2029
  ssh "${SSH_OPTS[@]}" "$SSH_HOST" "$1"
}

run_rsync() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[dry-run] rsync'
    local arg
    for arg in "$@"; do
      printf ' %q' "$arg"
    done
    printf '\n'
    return 0
  fi
  rsync "$@"
}

# Print z/x/y.webp for the centre listed in metadata.json (XYZ / Web Mercator).
tile_rel_path() {
  python3 - "$1" <<'PY'
import json
import math
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    meta = json.load(fh)

center = meta.get("center", meta.get("centre"))
if not isinstance(center, (list, tuple)) or len(center) < 2:
    sys.stderr.write("metadata.json needs center: [lon, lat, zoom]\n")
    sys.exit(1)

lon = float(center[0])
lat = float(center[1])
if len(center) >= 3:
    zoom = int(center[2])
else:
    zoom = int(meta.get("minzoom", 17))
if "minzoom" in meta:
    zoom = max(zoom, int(meta["minzoom"]))
if "maxzoom" in meta:
    zoom = min(zoom, int(meta["maxzoom"]))
if zoom < 0 or zoom > 28:
    sys.stderr.write("zoom out of range: %s\n" % zoom)
    sys.exit(1)

n = 2 ** zoom
x = int(math.floor((lon + 180.0) / 360.0 * n))
lat = max(min(lat, 85.05112878), -85.05112878)
lat_rad = math.radians(lat)
y = int(math.floor((1.0 - math.log(math.tan(lat_rad) + (1.0 / math.cos(lat_rad))) / math.pi) / 2.0 * n))
x = max(0, min(n - 1, x))
y = max(0, min(n - 1, y))
sys.stdout.write("%d/%d/%d.webp\n" % (zoom, x, y))
PY
}

command -v rsync >/dev/null 2>&1 || die "rsync not found"
command -v python3 >/dev/null 2>&1 || die "python3 not found"
command -v curl >/dev/null 2>&1 || die "curl not found"
if [[ "$DRY_RUN" != "1" ]]; then
  command -v ssh >/dev/null 2>&1 || die "ssh not found"
fi

echo "tiles: $TILES"
if [[ "$DELETE" == "1" ]]; then
  echo "rsync --delete is ON"
else
  echo "rsync --delete is off (pass --delete to remove remote tiles that are not local)"
fi

rsync_args=(-az --no-owner --no-group -e "$RSYNC_RSH")
if [[ "$DELETE" == "1" ]]; then
  rsync_args+=(--delete)
fi

missing=0
if [[ ! -d "$TILES" || ! -f "$TILES/metadata.json" ]]; then
  echo "missing ${TILES}/metadata.json" >&2
  echo "build tiles with scripts/build_ortho_tiles.sh or set TILES_DIR" >&2
  missing=1
  if [[ "$DRY_RUN" != "1" ]]; then
    exit 1
  fi
fi

echo "== upload =="
run_remote "mkdir -p ${REMOTE_TILES}"
[ "$DRY_RUN" = 1 ] || chmod -R u+rwX,go+rX "$TILES"  # GDAL writes 0600; nginx needs world-readable
run_rsync "${rsync_args[@]}" "$TILES/" "${SSH_HOST}:${REMOTE_TILES}/"

if [[ "$missing" == "1" ]]; then
  echo "tile probe skipped: metadata.json not found" >&2
  exit 1
fi

rel="$(tile_rel_path "$TILES/metadata.json")"
[[ "$rel" =~ ^[0-9]+/[0-9]+/[0-9]+\.webp$ ]] || die "unexpected tile path: $rel"
url="${PUBLIC_PREFIX}/${rel}"

echo "== probe ${url} =="
if [[ "$DRY_RUN" == "1" ]]; then
  printf '[dry-run] curl -sS -o /dev/null -w %%{http_code} --max-time 20 %q\n' "$url"
  echo "dry-run complete. tile ${rel} was not requested."
  exit 0
fi

set +e
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url")
rc=$?
set -e
echo "tile ${url} -> HTTP ${code:-error} (curl ${rc})"
if [[ "$rc" -ne 0 || "$code" != "200" ]]; then
  die "tile probe failed"
fi
