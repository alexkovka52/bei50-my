# Deploying dementra.md

The app runs on the shared host `inventica-crm` (`root@138.197.178.212`) as the
container `siret3-web`. nginx on that host proxies `dementra.md` to
`127.0.0.1:43180`. These scripts touch only the paths below. Do not restart
other containers or edit other nginx sites.

| Script | What it changes |
| --- | --- |
| `web/scripts/deploy.sh` | Local `web/.deploy/standalone/`. Remote `/opt/dementra-releases/<UTC>-<sha>/`, `/opt/siret3`, `/opt/siret3.bak-<UTC>`, container `siret3-web` (restart only). |
| `web/scripts/deploy_tiles.sh` | Remote `/opt/dementra-tiles/ortho/` only. |
| `web/scripts/install_nginx_tiles.sh` | Remote `/etc/nginx/snippets/dementra-tiles.conf` and `/etc/nginx/sites-available/dementra.md` (443 server blocks). |

`--dry-run` on any script prints the remote commands and does not ssh or rsync.
`deploy.sh --dry-run` still runs `npm ci`, lint, test, and build on this machine.

Run them from the repo root or from `web/`.

## App

```bash
web/scripts/deploy.sh --dry-run   # build + print the plan
web/scripts/deploy.sh             # build, upload, swap
web/scripts/deploy.sh --force     # allow a dirty web/ tree
```

Steps: refuse a dirty `web/` unless `--force`; `npm ci`, `npm run lint`,
`npm test`, `npm run build`; assemble `web/.deploy/standalone/` (standalone
output, plus `.next/static` and `public/` next to `server.js`); `rsync -az` to
`/opt/dementra-releases/<UTC timestamp>-<git short sha>/`; on the server
`cp -a /opt/siret3 /opt/siret3.bak-<timestamp>`, `rsync -a --delete` the release
onto `/opt/siret3`, `docker restart siret3-web`. It then polls
`http://127.0.0.1:43180/` for 30 seconds and checks `/data/summary.json` returns
200, and from this machine checks `https://dementra.md/` and
`https://dementra.md/data/summary.json`. If that fails, it copies the backup
back and restarts the container. After a good deploy it keeps the 5 newest
releases and the 3 newest backups.

`web/.deploy/` is a local staging directory. It is not part of the app source.

## Tiles

Ortho tiles are built by `scripts/build_ortho_tiles.sh` into `dist/tiles/ortho/`
(gitignored), with `metadata.json` `center: [lon, lat, zoom]`.

```bash
web/scripts/deploy_tiles.sh --dry-run
web/scripts/deploy_tiles.sh                 # add/update files, leave extras on the server
web/scripts/deploy_tiles.sh --delete        # make the server match this directory
TILES_DIR=/path/to/ortho web/scripts/deploy_tiles.sh
```

The script rsyncs to `/opt/dementra-tiles/ortho/` and requests the centre tile at
`https://dementra.md/tiles/ortho/{z}/{x}/{y}.webp`. `--delete` is off unless you
pass it. nginx must already serve `/tiles/` (next section) or the probe 404s.

## nginx `/tiles/`

`deploy/nginx/dementra-tiles.conf` is an include for the TLS server block.
`location /tiles/` aliases `/opt/dementra-tiles/` (both with a trailing slash),
so `/tiles/ortho/...` is `/opt/dementra-tiles/ortho/...`. There is no
`try_files`: with `alias`, `try_files` looks up `/opt/dementra-tiles/tiles/...`
and 404s every tile.

The snippet turns on `gzip` and `gzip_proxied` and does not set `gzip_types`.
A `gzip_types` line in this server block would replace the list inherited from
`http`, and CSS and JS for the whole vhost would stop being compressed. To gzip
the JSON and GeoJSON the app serves, add `application/json` and
`application/geo+json` to the `gzip_types` list in the `http` block.

```bash
web/scripts/install_nginx_tiles.sh --dry-run
web/scripts/install_nginx_tiles.sh
```

The installer copies the snippet to `/etc/nginx/snippets/dementra-tiles.conf`,
backs up `/etc/nginx/sites-available/dementra.md`, and inserts
`include snippets/dementra-tiles.conf;` into each server block that listens on
443. A second run does not insert it again. It runs `nginx -t` and reloads.
If `nginx -t` fails, it puts the site file and the previous snippet back and
does not reload.

## Roll back by hand

App, on `inventica-crm` (pick a backup; names sort by time):

```bash
ls -1d /opt/siret3.bak-* | sort
rsync -a --delete /opt/siret3.bak-YYYYMMDDTHHMMSSZ/ /opt/siret3/
docker restart siret3-web
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:43180/
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:43180/data/summary.json
```

A previous bundle is also under `/opt/dementra-releases/`. Copying one of those
over `/opt/siret3/` is the same swap the script does. Do not `rm` `/opt/siret3`
itself: the container bind-mounts that directory.

Tiles have no server-side backup. Upload the previous `dist/tiles/ortho/` again.
Use `--delete` only when that directory is the full set you want to keep.

nginx:

```bash
ls -1t /etc/nginx/sites-available/dementra.md.bak-* | head
cp -a /etc/nginx/sites-available/dementra.md.bak-YYYYMMDDTHHMMSSZ /etc/nginx/sites-available/dementra.md
# if the snippet itself was bad, restore /etc/nginx/snippets/dementra-tiles.conf.bak-<timestamp>
nginx -t && systemctl reload nginx
```
