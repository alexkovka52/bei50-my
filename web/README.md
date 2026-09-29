# Dementra

Aerial vineyard intelligence for the Sireț3 flight. The Next.js app in `web/` shows the overview, tilted map, inspector and farmer walks, block ranks, a printable report, and how the model reads the vineyard.

Dev server: [http://127.0.0.1:43173](http://127.0.0.1:43173).

## Develop

```bash
cd web
npm ci
printf 'TILES_DEV_ORIGIN=http://127.0.0.1:8787\n' > .env.development.local
npm run dev
```

Imagery is pre-built tiles. In development, `next.config.ts` rewrites `/tiles/*` to `TILES_DEV_ORIGIN`. Start a static server for `dist/tiles` from the repo root (skip this if port 8787 is already serving them):

```bash
python3 -m http.server 8787 --bind 127.0.0.1 --directory dist/tiles
```

Production nginx serves `/tiles/` itself. The rewrite is dev-only.

`npm run lint`, `npm test`, and `npm run build` are the checks before a deploy.

## Data bundle

Pages read `web/public/data/` (summary, blocks, layers, routes, model). Publish that bundle from the repo root with the processing tools. Do not hand-edit the JSON.

From the repo root, with the processing virtualenv active (`PYTHONPATH` must see `processing/src`):

```bash
PYTHONPATH=$PWD/processing/src python -m siret3.cli web-bundle \
  --layers data/gt_32635.geojson \
  --assemble \
  --source marcaj-labels \
  --inspector route.geojson \
  --farmer route_farmer.geojson \
  --baseline data/eval/baseline_test.json \
  --flown-on 2026-09-20 \
  --out-dir web/public/data
```

Missing files render an empty state on each route. Null measurements stay "Not measured" or "Pending".

## Deploy

Scripts live in `web/scripts/`. Run them from the repo root or from `web/`. Details, hosts, and rollback are in [scripts/README-deploy.md](scripts/README-deploy.md).

| Script | What it changes |
| --- | --- |
| `web/scripts/deploy.sh` | Builds the app and swaps the `siret3-web` container on `dementra.md`. |
| `web/scripts/deploy_tiles.sh` | Uploads ortho tiles to `/opt/dementra-tiles/ortho/`. |
| `web/scripts/install_nginx_tiles.sh` | Installs the nginx `/tiles/` snippet for `dementra.md`. |

`--dry-run` prints the remote commands and does not ssh. `deploy.sh --dry-run` still runs `npm ci`, lint, test, and build on this machine.
