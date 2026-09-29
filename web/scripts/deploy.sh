#!/usr/bin/env bash
# Build the Next standalone bundle and swap it onto inventica-crm.
# Touches only /opt/siret3, /opt/siret3.bak-*, /opt/dementra-releases/*, and container siret3-web.
# --dry-run still builds locally and prints every remote command. It does not ssh or rsync.
set -euo pipefail

SSH_HOST=inventica-crm
CONTAINER=siret3-web
REMOTE_APP=/opt/siret3
REMOTE_RELEASES=/opt/dementra-releases
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20)
# Passed to rsync -e so a real upload cannot sit on a password prompt.
RSYNC_RSH="ssh -o BatchMode=yes -o ConnectTimeout=20"

DRY_RUN=0
FORCE=0
NEED_ROLLBACK=0
TS=""

usage() {
  cat <<'EOF'
Usage: web/scripts/deploy.sh [--dry-run] [--force]

  Run from the repo root or from web/. Builds web/ (npm ci, lint, test, build),
  assembles web/.deploy/standalone/, uploads it, and swaps /opt/siret3.

  --dry-run   print remote commands; do not connect
  --force     deploy even if web/ has uncommitted changes
EOF
}

die() {
  echo "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
  shift
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$WEB_DIR/.." && pwd)"

case "$WEB_DIR" in
  */web) ;;
  *) die "refusing to run: WEB_DIR is not web/ ($WEB_DIR)" ;;
esac
case "$REMOTE_APP" in
  /opt/siret3) ;;
  *) die "refusing to run: unexpected app path $REMOTE_APP" ;;
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

run_remote_script() {
  local script=$1
  shift
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[dry-run] ssh'
    local opt arg
    for opt in "${SSH_OPTS[@]}"; do
      printf ' %q' "$opt"
    done
    printf ' %q bash -s --' "$SSH_HOST"
    for arg in "$@"; do
      printf ' %q' "$arg"
    done
    printf '\n%s\n[dry-run] end remote script\n' "$script"
    return 0
  fi
  printf '%s\n' "$script" | ssh "${SSH_OPTS[@]}" "$SSH_HOST" bash -s -- "$@"
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

rollback_script() {
  cat <<'EOF'
set -euo pipefail
ts=$1
app=/opt/siret3
backup="/opt/siret3.bak-${ts}"
case "$backup" in
  /opt/siret3.bak-*) ;;
  *) echo "refusing to restore unexpected path $backup" >&2; exit 1 ;;
esac
if [[ ! -d "$backup" ]]; then
  echo "no backup at $backup; live tree left as-is" >&2
  exit 1
fi
echo "restoring $app from $backup"
rsync -a --delete "${backup}/" "${app}/"
docker restart siret3-web
docker ps --filter name=siret3-web
echo "restored $app from $backup"
EOF
}

swap_script() {
  cat <<'EOF'
set -euo pipefail
ts=$1
rel=$2
app=/opt/siret3
releases=/opt/dementra-releases
backup="/opt/siret3.bak-${ts}"
release="${releases}/${rel}"
need_rollback=0

case "$backup" in
  /opt/siret3.bak-*) ;;
  *) echo "refusing backup path $backup" >&2; exit 1 ;;
esac
case "$release" in
  /opt/dementra-releases/*) ;;
  *) echo "refusing release path $release" >&2; exit 1 ;;
esac

if [[ ! -d "$release" || ! -f "$release/server.js" ]]; then
  echo "refusing to swap: $release/server.js is missing" >&2
  exit 1
fi
if [[ ! -d "$app" ]]; then
  echo "refusing to swap: $app does not exist" >&2
  exit 1
fi

echo "backup: $backup"
cp -a "$app" "$backup"

restore() {
  echo "swap failed; restoring $app from $backup" >&2
  rsync -a --delete "${backup}/" "${app}/"
  docker restart siret3-web
  docker ps --filter name=siret3-web
}

cleanup() {
  status=$?
  trap - EXIT
  if [[ "$need_rollback" == "1" ]]; then
    restore || true
    status=1
  fi
  exit "$status"
}
trap cleanup EXIT

need_rollback=1
rsync -a --delete "${release}/" "${app}/"
docker restart siret3-web

deadline=$(( $(date +%s) + 30 ))
ok=0
while [[ "$(date +%s)" -lt "$deadline" ]]; do
  if curl -fsS -o /dev/null --max-time 2 http://127.0.0.1:43180/; then
    ok=1
    break
  fi
  sleep 1
done
if [[ "$ok" != "1" ]]; then
  echo "health check failed after 30s: http://127.0.0.1:43180/" >&2
  exit 1
fi
echo "health ok: http://127.0.0.1:43180/"

set +e
summary_code=$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:43180/data/summary.json)
summary_rc=$?
set -e
echo "health http://127.0.0.1:43180/data/summary.json -> ${summary_code:-error} (curl ${summary_rc})"
if [[ "$summary_rc" -ne 0 || "$summary_code" != "200" ]]; then
  exit 1
fi

need_rollback=0
echo "server health ok"
EOF
}

prune_script() {
  cat <<'EOF'
set -euo pipefail
LC_ALL=C

prune_sorted() {
  keep=$1
  prefix=$2
  shift 2
  n=$#
  if [[ "$n" -le "$keep" ]]; then
    return 0
  fi
  drop=$((n - keep))
  i=1
  for path in "$@"; do
    if [[ "$i" -le "$drop" ]]; then
      case "$path" in
        "$prefix"*) ;;
        *) echo "refusing to delete $path" >&2; exit 1 ;;
      esac
      echo "pruning $path"
      rm -rf "$path"
    fi
    i=$((i + 1))
  done
}

rel_args=()
if [[ -d /opt/dementra-releases ]]; then
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    rel_args+=("$path")
  done < <(find /opt/dementra-releases -mindepth 1 -maxdepth 1 -type d | sort)
fi
if [[ ${#rel_args[@]} -gt 0 ]]; then
  prune_sorted 5 /opt/dementra-releases/ "${rel_args[@]}"
fi

bak_args=()
while IFS= read -r path; do
  [[ -n "$path" ]] || continue
  bak_args+=("$path")
done < <(find /opt -maxdepth 1 -type d -name 'siret3.bak-*' | sort)
if [[ ${#bak_args[@]} -gt 0 ]]; then
  prune_sorted 3 /opt/siret3.bak- "${bak_args[@]}"
fi
EOF
}

on_exit() {
  status=$?
  trap - EXIT
  if [[ "$NEED_ROLLBACK" == "1" && "$DRY_RUN" != "1" ]]; then
    echo "failure after swap; restoring ${REMOTE_APP} from ${REMOTE_APP}.bak-${TS}" >&2
    if ! run_remote_script "$(rollback_script)" "$TS"; then
      echo "restore failed; live tree may be the failed release. backup: ${REMOTE_APP}.bak-${TS}" >&2
    fi
    status=1
  fi
  exit "$status"
}
trap on_exit EXIT

command -v npm >/dev/null 2>&1 || die "npm not found"
command -v rsync >/dev/null 2>&1 || die "rsync not found"
command -v git >/dev/null 2>&1 || die "git not found"
command -v curl >/dev/null 2>&1 || die "curl not found"
if [[ "$DRY_RUN" != "1" ]]; then
  command -v ssh >/dev/null 2>&1 || die "ssh not found"
fi

echo "== preflight =="
dirty="$(git -C "$REPO_ROOT" status --porcelain -- web ':!web/.deploy')"
if [[ -n "$dirty" ]]; then
  echo "WARNING: web/ has uncommitted changes:" >&2
  printf '%s\n' "$dirty" >&2
  if [[ "$FORCE" != "1" ]]; then
    die "refusing to deploy a dirty web/. Re-run with --force to override."
  fi
  echo "proceeding because --force was given" >&2
fi

(
  cd "$WEB_DIR"
  npm ci
  npm run lint
  npm test
  npm run build
)

echo "== assemble =="
standalone_src="$WEB_DIR/.next/standalone"
[[ -d "$standalone_src" ]] || die "missing $standalone_src (next build did not emit standalone output)"

app_dir=""
if [[ -f "$standalone_src/server.js" ]]; then
  app_dir="$standalone_src"
else
  best=""
  best_depth=999999
  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    depth=$(awk -F/ '{print NF}' <<<"$file")
    if [[ -z "$best" || "$depth" -lt "$best_depth" ]]; then
      best=$file
      best_depth=$depth
    fi
  done < <(find "$standalone_src" -name server.js -type f -not -path '*/node_modules/*')
  if [[ -n "$best" ]]; then
    app_dir="$(dirname "$best")"
    echo "standalone server.js is nested at $best"
  fi
fi
[[ -n "$app_dir" && -f "$app_dir/server.js" ]] || die "refusing to deploy: server.js is missing under $standalone_src"

stage="$WEB_DIR/.deploy/standalone"
rm -rf "$WEB_DIR/.deploy"
mkdir -p "$stage"
cp -a "$app_dir"/. "$stage"/
if [[ ! -d "$stage/node_modules" && -d "$standalone_src/node_modules" && "$app_dir" != "$standalone_src" ]]; then
  cp -a "$standalone_src/node_modules" "$stage/node_modules"
fi
[[ -d "$WEB_DIR/.next/static" ]] || die "missing $WEB_DIR/.next/static"
[[ -d "$WEB_DIR/public" ]] || die "missing $WEB_DIR/public"
rm -rf "$stage/.next/static"
mkdir -p "$stage/.next"
cp -a "$WEB_DIR/.next/static" "$stage/.next/static"
rm -rf "$stage/public"
cp -a "$WEB_DIR/public" "$stage/public"
[[ -f "$stage/server.js" ]] || die "refusing to deploy: $stage/server.js is missing"
[[ -d "$stage/node_modules" ]] || die "refusing to deploy: $stage/node_modules is missing"
[[ -d "$stage/.next/static" ]] || die "refusing to deploy: static assets were not copied"
[[ -d "$stage/public" ]] || die "refusing to deploy: public/ was not copied"
echo "assembled $stage"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
SHA_FULL="$(git -C "$REPO_ROOT" rev-parse HEAD)"
REL="${TS}-${SHA}"
[[ "$REL" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]+$ ]] || die "unexpected release id: $REL"

echo "== release /opt/dementra-releases/${REL} =="
echo "deploying git sha ${SHA_FULL}"

echo "== docker ps (before) =="
run_remote "docker ps --filter name=${CONTAINER}"

echo "== upload =="
run_remote "mkdir -p ${REMOTE_RELEASES}/${REL}"
run_rsync -az --chmod=D755,F644 --no-owner --no-group -e "$RSYNC_RSH" "$stage/" "${SSH_HOST}:${REMOTE_RELEASES}/${REL}/"

echo "== swap =="
if [[ "$DRY_RUN" != "1" ]]; then
  NEED_ROLLBACK=1
fi
run_remote_script "$(swap_script)" "$TS" "$REL"

echo "== public health =="
if [[ "$DRY_RUN" == "1" ]]; then
  echo "[dry-run] curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 https://dementra.md/"
  echo "[dry-run] curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 https://dementra.md/data/summary.json"
else
  set +e
  home_code=$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 https://dementra.md/)
  home_rc=$?
  summary_code=$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 https://dementra.md/data/summary.json)
  summary_rc=$?
  set -e
  echo "https://dementra.md/ -> ${home_code:-error} (curl ${home_rc})"
  echo "https://dementra.md/data/summary.json -> ${summary_code:-error} (curl ${summary_rc})"
  if [[ "$home_rc" -ne 0 || "$home_code" != "200" || "$summary_rc" -ne 0 || "$summary_code" != "200" ]]; then
    die "public health check failed"
  fi
fi
NEED_ROLLBACK=0

echo "== docker ps (after) =="
run_remote "docker ps --filter name=${CONTAINER}"

echo "== prune (keep 5 releases, 3 backups) =="
run_remote_script "$(prune_script)"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "dry-run complete. git sha ${SHA_FULL} was not deployed."
else
  echo "deployed git sha ${SHA_FULL}"
  echo "release: ${REMOTE_RELEASES}/${REL}"
  echo "backup: ${REMOTE_APP}.bak-${TS}"
fi
