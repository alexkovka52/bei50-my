# Task D — deploy tooling for dementra.md (Layer 1)

Read first: `docs/superpowers/specs/2026-09-29-dementra-frontend.md`, `AGENTS.md`, `web/next.config.ts`,
`web/Dockerfile`, `web/package.json`.

Scope: `web/scripts/deploy.sh`, `web/scripts/deploy_tiles.sh`, `web/scripts/install_nginx_tiles.sh`,
`deploy/nginx/dementra-tiles.conf`, `web/scripts/README-deploy.md` (all new). **You must not run any of these
against the server, must not ssh anywhere, and must not deploy.** Test with `--dry-run` only.

## Facts about production (verified, read-only)
- SSH alias `inventica-crm` (root@138.197.178.212). Shared box with ~30 other containers: touch nothing else.
- Container `siret3-web`: image `node:22-alpine`, bind mount host `/opt/siret3` → `/app`, workdir `/app`,
  cmd `node server.js`, port `127.0.0.1:43180->43180`, restart `unless-stopped`, env `PORT=43180
  HOSTNAME=0.0.0.0` (from the Dockerfile the bundle was built with).
- nginx site file `/etc/nginx/sites-available/dementra.md` (enabled), `server_name dementra.md
  www.dementra.md`, `location / { proxy_pass http://127.0.0.1:43180; }`, TLS on the server.
- Next config: `output: "standalone"`; the standalone bundle needs `.next/static` and `public/` copied next to
  `server.js`.

## Deliver
1. `web/scripts/deploy.sh [--dry-run]` (bash, `set -euo pipefail`, run from repo root or `web/`):
   1. Preflight: clean `git status` for `web/` (warn, allow `--force`), `npm ci`, `npm run lint`,
      `npm test`, `npm run build`.
   2. Assemble `web/.deploy/standalone/` = `.next/standalone/` + `.next/static` → `.next/static` +
      `public/` → `public/`. Refuse if `server.js` is missing.
   3. Upload to `inventica-crm:/opt/dementra-releases/<UTC timestamp>-<git short sha>/` with `rsync -az`.
   4. Swap: on the server, `cp -a /opt/siret3 /opt/siret3.bak-<ts>`, `rsync -a --delete <release>/ /opt/siret3/`,
      `docker restart siret3-web`.
   5. Health: poll `curl -fsS http://127.0.0.1:43180/` on the server (30 s) and `curl -fsS https://dementra.md/`
      locally; also check `/data/summary.json` returns 200.
   6. On failure: restore `/opt/siret3` from the backup, restart the container, exit 1.
   7. Keep the 3 newest backups and 5 newest releases; delete older ones.
   8. `--dry-run` prints every remote command instead of running it (still builds locally).
   9. Print `docker ps --filter name=siret3-web` before/after and the deployed git sha.
2. `web/scripts/deploy_tiles.sh [--dry-run] [--delete]`: rsync `dist/tiles/ortho/` →
   `inventica-crm:/opt/dementra-tiles/ortho/` (`--delete` only with the flag), then curl a tile listed in
   `metadata.json` centre through `https://dementra.md/tiles/ortho/...` and report the status.
3. `deploy/nginx/dementra-tiles.conf`: a snippet included inside the `dementra.md` server block:
   `location /tiles/ { alias /opt/dementra-tiles/; try_files $uri =404; add_header Cache-Control
   "public, max-age=2592000, immutable"; add_header Access-Control-Allow-Origin "*"; access_log off; }`
   with `types { image/webp webp; application/json json; }`, and gzip for JSON/GeoJSON served by the app
   (`gzip on; gzip_proxied any; gzip_types application/json application/geo+json;` placed so it is valid
   inside a `server` block).
4. `web/scripts/install_nginx_tiles.sh [--dry-run]`: copy the snippet to `/etc/nginx/snippets/`, insert
   `include snippets/dementra-tiles.conf;` into the `dementra.md` server block(s) that listen on 443
   (idempotent: skip if present), back up the site file first, `nginx -t`, reload; if `nginx -t` fails,
   restore the backup and exit 1.
5. `web/scripts/README-deploy.md`: the three commands, what each touches, how to roll back by hand.
6. `bash -n` every script, run `shellcheck` if available, and run `web/scripts/deploy.sh --dry-run` and
   `web/scripts/deploy_tiles.sh --dry-run` to show the printed plan (the dry-run build must succeed; if
   `web/` currently fails to build, report it but keep the scripts correct).

## Rules
- Commit on your current branch (messages end with `Co-Authored-By: Grok 4.7 <noreply@x.ai>`).
  No push, no ssh, no deploy. Report: files, dry-run output (trimmed), shellcheck results, open issues.
