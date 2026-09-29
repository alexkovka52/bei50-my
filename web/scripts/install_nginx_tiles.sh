#!/usr/bin/env bash
# Copy deploy/nginx/dementra-tiles.conf into the dementra.md TLS server.
# Touches only /etc/nginx/sites-available/dementra.md and /etc/nginx/snippets/dementra-tiles.conf.
# --dry-run prints the remote commands and does not connect.
set -euo pipefail

SSH_HOST=inventica-crm
SITE_PATH=/etc/nginx/sites-available/dementra.md
SNIP_PATH=/etc/nginx/snippets/dementra-tiles.conf
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20)
RSYNC_RSH="ssh -o BatchMode=yes -o ConnectTimeout=20"

DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: web/scripts/install_nginx_tiles.sh [--dry-run]

  Copy deploy/nginx/dementra-tiles.conf to /etc/nginx/snippets/ on inventica-crm,
  insert `include snippets/dementra-tiles.conf;` into each dementra.md server
  block that listens on 443 (skip a block that already has it), nginx -t, reload.
  If nginx -t fails, the site file and the previous snippet are restored.

  --dry-run   print remote commands; do not connect
EOF
}

die() {
  echo "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
  shift
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONF="$REPO_ROOT/deploy/nginx/dementra-tiles.conf"
[[ -f "$CONF" ]] || die "missing snippet: $CONF"

insert_py() {
  cat <<'PY'
import os
import re
import stat
import sys
import tempfile

INCLUDE_LINE = "include snippets/dementra-tiles.conf;"
LISTEN_RE = re.compile(r"^[ \t]*listen\s+([^;#]*)", re.M)
INCLUDE_RE = re.compile(
    r"^[ \t]*include\s+snippets/dementra-tiles\.conf\s*;[ \t]*$",
    re.M,
)


def mask(text):
    out = list(text)
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c in ("'", '"'):
            quote = c
            i += 1
            while i < n:
                if text[i] == "\\":
                    nxt = i + 1
                    if nxt < n:
                        if text[i] != "\n":
                            out[i] = " "
                        if text[nxt] != "\n":
                            out[nxt] = " "
                        i = nxt + 1
                        continue
                if text[i] == quote:
                    break
                if text[i] != "\n":
                    out[i] = " "
                i += 1
            i += 1
            continue
        if c == "#":
            while i < n and text[i] != "\n":
                out[i] = " "
                i += 1
            continue
        i += 1
    return "".join(out)


def ident_at(text, i, word):
    if not text.startswith(word, i):
        return False
    if i > 0 and (text[i - 1].isalnum() or text[i - 1] == "_"):
        return False
    end = i + len(word)
    if end < len(text) and (text[end].isalnum() or text[end] == "_"):
        return False
    return True


def server_spans(masked):
    spans = []
    i = 0
    n = len(masked)
    while i < n:
        if ident_at(masked, i, "server"):
            j = i + 6
            while j < n and masked[j] in " \t\r\n":
                j += 1
            if j < n and masked[j] == "{":
                depth = 1
                k = j + 1
                while k < n and depth:
                    if masked[k] == "{":
                        depth += 1
                    elif masked[k] == "}":
                        depth -= 1
                    k += 1
                if depth != 0:
                    sys.stderr.write("unbalanced braces in server block\n")
                    sys.exit(1)
                spans.append((i, k))
                i = k
                continue
        i += 1
    return spans


def listens_443(masked_block):
    for match in LISTEN_RE.finditer(masked_block):
        if re.search(r"(?<!\d)443(?!\d)", match.group(1)):
            return True
    return False


def transform(original):
    masked = mask(original)
    found = 0
    inserts = []
    for start, end in server_spans(masked):
        block = masked[start:end]
        if not listens_443(block):
            continue
        found += 1
        if INCLUDE_RE.search(block):
            continue
        indent = "    "
        indented = re.search(r"^([ \t]+)listen\s", block, re.M)
        if indented:
            indent = indented.group(1)
        brace = end - 1
        if original[brace] != "}":
            sys.stderr.write("parser lost the server closing brace\n")
            sys.exit(1)
        inserts.append((brace, indent + INCLUDE_LINE + "\n"))
    if found == 0:
        sys.stderr.write("no server block with listen 443 in the site file\n")
        sys.exit(1)
    if not inserts:
        sys.stderr.write("include already present on %d tls server block(s)\n" % found)
        return original, False
    pieces = []
    cursor = 0
    for brace, line in sorted(inserts):
        pieces.append(original[cursor:brace])
        pieces.append(line)
        cursor = brace
    pieces.append(original[cursor:])
    sys.stderr.write("inserted include into %d server block(s)\n" % len(inserts))
    return "".join(pieces), True


def main():
    path = sys.argv[1]
    with open(path, "r", encoding="utf-8") as fh:
        original = fh.read()
    updated, changed = transform(original)
    if not changed:
        return
    mode = stat.S_IMODE(os.stat(path).st_mode)
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(prefix=".dementra-site.", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(updated)
            fd = None
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except Exception:
        if fd is not None:
            try:
                os.close(fd)
            except OSError:
                pass
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


if __name__ == "__main__":
    main()
PY
}

remote_install_script() {
  cat <<'HEAD'
set -euo pipefail
ts=$1
newsnip=$2
site=/etc/nginx/sites-available/dementra.md
snip=/etc/nginx/snippets/dementra-tiles.conf
bak_site="${site}.bak-${ts}"
bak_snip="${snip}.bak-${ts}"
need_restore=0
had_snip=0

case "$bak_site" in
  /etc/nginx/sites-available/dementra.md.bak-*) ;;
  *) echo "refusing backup path $bak_site" >&2; exit 1 ;;
esac
if [[ ! "$ts" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
  echo "bad timestamp" >&2
  exit 1
fi
if [[ ! -f "$site" ]]; then
  echo "missing $site" >&2
  exit 1
fi
if [[ ! -f "$newsnip" ]]; then
  echo "missing uploaded snippet $newsnip" >&2
  exit 1
fi

cp -a "$site" "$bak_site"
echo "site backup: $bak_site"
mkdir -p /etc/nginx/snippets
if [[ -f "$snip" ]]; then
  cp -a "$snip" "$bak_snip"
  had_snip=1
  echo "snippet backup: $bak_snip"
fi
cp -a "$newsnip" "$snip"
rm -f "$newsnip"
need_restore=1

restore() {
  echo "restoring nginx files" >&2
  cp -a "$bak_site" "$site"
  if [[ "$had_snip" == "1" ]]; then
    cp -a "$bak_snip" "$snip"
  else
    rm -f "$snip"
  fi
}

cleanup() {
  status=$?
  trap - EXIT
  if [[ "$need_restore" == "1" ]]; then
    restore || true
    status=1
  fi
  exit "$status"
}
trap cleanup EXIT

python3 - "$site" <<'DEMENTRA_PY'
HEAD
  insert_py
  cat <<'TAIL'
DEMENTRA_PY

if ! nginx -t; then
  echo "nginx -t failed" >&2
  exit 1
fi
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx
else
  nginx -s reload
fi
need_restore=0
echo "nginx reloaded with snippets/dementra-tiles.conf"
TAIL
}

command -v rsync >/dev/null 2>&1 || die "rsync not found"
if [[ "$DRY_RUN" != "1" ]]; then
  command -v ssh >/dev/null 2>&1 || die "ssh not found"
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
[[ "$TS" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || die "bad timestamp: $TS"
REMOTE_TMP="/tmp/dementra-tiles.conf.${TS}"

echo "snippet: $CONF"
echo "site: $SITE_PATH"
echo "dest: $SNIP_PATH"

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

run_rsync -az -e "$RSYNC_RSH" "$CONF" "${SSH_HOST}:${REMOTE_TMP}"
run_remote_script "$(remote_install_script)" "$TS" "$REMOTE_TMP"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "dry-run complete. nginx was not changed."
fi
