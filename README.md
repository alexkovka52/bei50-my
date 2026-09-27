# gigahack-bei50

GigaHack Sireț3 vineyard / Marcaj: research, one-shot CVAT 1.1 import, planar measurements in **EPSG:32635**, a closed inspection walk, and a MapLibre viewer.

Deadline: Sunday 27 Sep 2026, 15:00 Chișinău. Marcaj is the scored annotation source.

Challenge context (do not lose):

- Official brief + must-haves: [`docs/challenge.md`](docs/challenge.md)
- Sireț3 imagery card: [`docs/siret3-dataset.md`](docs/siret3-dataset.md)
- Score card (25 / 10 / 15 / 10 / 25 / 15): [`docs/scoring.md`](docs/scoring.md)
- How to draw labels: [`docs/annotation-rules.md`](docs/annotation-rules.md)
- Provider briefing vs PDF: [`docs/provider-briefing.md`](docs/provider-briefing.md)
- SOTA lock (what we train): [`docs/sota-research.md`](docs/sota-research.md)
- Brief → repo map (some boxes stale): [`docs/must-implement.md`](docs/must-implement.md)
- Weekend runbook: [`docs/vineyard-plan.md`](docs/vineyard-plan.md)
- Research catalog: [`docs/vineyard-research.md`](docs/vineyard-research.md)
- Agent file index: [`AGENTS.md`](AGENTS.md)

## What this repo is

End-to-end Sireț3 pipeline: public-data train → GIS derive → Marcaj correct → planar measurements and two closed walks in **EPSG:32635** → MapLibre. Manual Sireț3 drawing stays in Marcaj.

```
docs/                 research + plan
data/challenge/       official Marcaj pack (tiles, route, rules, examples, source ortho)
processing/           rasterio / geopandas / shapely / NetworkX (`siret3` CLI)
models/               YOLO11m-seg canopy + YOLO12 waste
web/                  Next.js + MapLibre (port 43173) — live layers, not SAMPLE
data/tiles/           unzip the 311 siret3_rXXX_cYYY.tif here before inventory
route.geojson         inspector walk: gaps + waste (25% file, 7.99 km, EPSG:32635)
route_farmer.geojson  farmer walk: waste only (4.29 km, same start)
measurements.csv      planar m / m² / ha from the current stitch
```

Agent notes: [`AGENTS.md`](AGENTS.md). Pack index: [`data/challenge/README.md`](data/challenge/README.md).

**Branch `frontend` is not this app.** It is a one-commit orphan with a white SVG canvas and DEMO DATA. Do not merge it into `main`. Work on `web/` here.

## Official data pack

Copied from the Marcaj Drive download into [`data/challenge/`](data/challenge/). Tile ZIPs and the source orthomosaic stay local (gitignored, about 1 GB). GeoJSON, PDFs, previews, and the example CVAT zip are in the tree.

| Path | What |
| --- | --- |
| `data/challenge/01_tiles/siret3_challenge_tiles_part1of5.zip` … `part5of5.zip` | 311 GeoTIFF tiles, EPSG:32635, 0.025 m/px, 2048×2048 px (51.2 m). Parts are ≤ 90 MB. |
| `data/challenge/01_tiles/overview.png` | 1 m/px overview. Tiles in yellow, route START in red. |
| `data/challenge/02_route/start.geojson` | Start and finish. Point in EPSG:32635: X 629504.70, Y 5220250.75 (47.1230335 N, 28.7073776 E), tile `siret3_r018_c010.tif`. |
| `data/challenge/02_route/passages.geojson` | Authorised passages. MultiPolygon, `type` = `passage`. |
| `data/challenge/02_route/forbidden.geojson` | Forbidden zones. MultiPolygon, `type` = `forbidden`. |
| `data/challenge/02_route/study_area.geojson` | Outline of the 311 tiles. |
| `data/challenge/02_route/preview_passages_forbidden.png` | Preview of passages and forbidden zones. |
| `data/challenge/03_docs/` | Challenge description, annotation rules, Marcaj quick start, Sireț3 dataset brief (PDF). |
| `data/challenge/04_source/siret3_source_orthomosaic_EPSG4326.tif` | Full source orthomosaic, EPSG:4326, as on OpenAerialMap. For whole-survey training only. |
| `data/challenge/05_examples/siret3_examples_cvat.zip` | Two annotated tiles in CVAT for images 1.1. Not scored. |
| `data/challenge/05_examples/preview_siret3_r021_c012.jpg` | Young vines, block `V01`: 25 regular rows, 399 canopies, 24 bare-soil inter-rows. |
| `data/challenge/05_examples/preview_siret3_r006_c004.jpg` | Sparse rows, block `V02`: 26 rows (5 disrupted), 251 canopies, mixed inter-rows. |

Unzip tiles into `data/tiles/` before `siret3 inventory`. Upload pre-annotations as CVAT 1.1 ZIPs of at most 90 MB (one ZIP per part works). All five parts, 311 files, then publish. Pre-annotations cannot be imported after publishing.

## Install

### Processing

```bash
cd processing
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest
siret3 --help
```

Optional OR-Tools routing: `pip install -e ".[route-ortools]"`.

Optional Docker:

```bash
docker build -t siret3-processing .
docker run --rm -v "$PWD:/data" siret3-processing inventory /data/data/tiles --allow-partial --out /data/data/tile_index.csv
```

### Web map

```bash
cd web
npm install
npm run dev
```

Local: [http://127.0.0.1:43173](http://127.0.0.1:43173). Public jury URL: [https://dementra.md](https://dementra.md). Packed layers in `web/public/layers/` are live Sireț3 geometry (badge **MARCAJ**). The raster is the public OpenAerialMap XYZ for item `683060c4025981aa411253c8`. The Demetra farm app stays on `dementra.prodiusenterprise.com`.

## Repro: model → one import → publish → measure → route → map

1. **Model (NVIDIA H100 80 GB, `ssh gpu-server`, `/home/prodius/projects/bei50`).** Riseholme COCO [10.5281/zenodo.19234907](https://doi.org/10.5281/zenodo.19234907) (CC-BY-4.0) + DroneWaste [10.5281/zenodo.17045559](https://doi.org/10.5281/zenodo.17045559) (CC-BY-4.0). Tracked weights: `models/weights/vineyard.pt`, `models/weights/waste.pt`. Same files on the [v0.1.0 GitHub release](https://github.com/CristianProdius/bei50/releases/tag/v0.1.0):

   ```bash
   mkdir -p models/weights
   curl -L -o models/weights/vineyard.pt https://github.com/CristianProdius/bei50/releases/download/v0.1.0/vineyard.pt
   curl -L -o models/weights/waste.pt https://github.com/CristianProdius/bei50/releases/download/v0.1.0/waste.pt
   ```

   | Weight | Arch | Train | Val | 311-tile infer |
   | --- | --- | --- | --- | --- |
   | `vineyard.pt` | YOLO11m-seg | Riseholme COCO, `--profile h100`, imgsz 1280 | mask mAP50 ~0.73 | `infer_311.sh` (26 Sep): 311 tiles. Riseholme head saw 0 Sireț3 plant masks. |
   | `waste.pt` | YOLO12m detect | DroneWaste, 60 epochs, imgsz 1280 | box mAP50 0.394 | same script, `--conf 0.4` → 60 boxes / 39 tiles |
   | `vineyard_marcaj.pt` (local, not the release) | YOLO11m-seg from `yolo11m-seg.pt` | 40 epochs, imgsz 640, batch 24, 12 tiles (10 Marcaj + 2 official examples) | mask mAP50 0.82 | chip infer 640 / stride 320 → 22,556 raw plants on 311 tiles |

   Wall time we measured: waste train 60 epochs on one H100; canopy + waste `infer_311.sh` finished 26 Sep ~01:05; Marcaj plant fine-tune 40 epochs + 311-tile chip infer the same afternoon. Stitch / both walks / web-layers run on a Mac (M-series), about 3 minutes for the two closed walks on the slim inter-row graph.

   To retrain the public-data pair:

   ```bash
   python models/train_yolo.py --task segment --data models/configs/vineyard.yaml --profile h100
   python models/train_yolo.py --task detect --data models/configs/waste.yaml --profile h100
   ```

   16 GB: `--profile gpu16` or `HARDWARE_PROFILE=gpu16` (`yolo11s-seg`, imgsz 1024, batch 4).

2. **Infer tiles.**

   ```bash
   python models/infer_yolo.py --weights models/weights/vineyard.pt --tiles data/tiles --out data/predictions
   ```

3. **Stitch IDs and write CVAT 1.1 ZIPs** (311 original GeoTIFF names, ≤ 90 MB each). Ready pack for re-upload: `data/cvat_zips_marcaj/` (five parts).

   ```bash
   siret3 inventory data/tiles --out data/tile_index.csv
   siret3 stitch data/predictions/merged.geojson --out data/stitched.geojson
   siret3 cvat-export data/tiles --out team_upload.zip
   ```

4. **Marcaj (human — this is the scored 50%).** Upload the five ZIPs, confirm 311 files, publish. Then on **every** job:

   - Vineyard tiles: one polygon per plant; one `row` through gaps; `interrow_area` between rows with `interrow_cover` (`bare_soil` / `vegetation` / `mixed` / `unassessable`). Same `vineyard_id` / `row_id` across tile edges.
   - Empty / orchard / pasture / village / tilled field with **no vine grid**: **No objects in this frame**.
   - **Submit** every job. Saved ≠ submitted. Only submitted jobs are scored.
   - Do not draw grass or bare fields as inter-row. Cover is an attribute on an inter-row that already sits between two vine rows.

5. **Measurements + both walks** from a **finished** Marcaj export (planar EPSG:32635, no DEM). Keep human plants and rows — do not run `stitch` on the export. Job-prefixed names (`1713_siret3_r017_c008.tif`) are stripped to the official tile name.

   ```bash
   siret3 marcaj-import data/marcaj_export --tiles data/tiles --out data/marcaj_32635.geojson
   siret3 inspect data/marcaj_32635.geojson --out inspections.geojson
   siret3 measurements data/marcaj_32635.geojson --out measurements.csv
   siret3 route data/marcaj_32635.geojson --targets inspections,waste --out route.geojson
   siret3 route data/marcaj_32635.geojson --targets waste --out route_farmer.geojson
   siret3 web-layers --layers data/marcaj_32635.geojson \
     --inspector route.geojson --farmer route_farmer.geojson \
     --measurements measurements.csv --inspections inspections.geojson \
     --forbidden data/challenge/02_route/forbidden.geojson \
     --passages data/challenge/02_route/passages.geojson \
     --out-dir web/public/layers
   ```

   `marcaj-import` accepts a CVAT ZIP, `annotations.xml`, json_simple, or a folder of those. Start must snap within 5 m. Both walks use inter-row ∪ authorised passages − forbidden. Inspector = 25% file. Farmer = waste collect.

   Last human dump (`data/marcaj_export/marcaj_cvat_2026-09-26.zip`) is **10 tiles / 951 shapes / 0 waste**. Import works (`data/marcaj_32635.geojson`). That graph does not reach the official start (155 m), so root `route.geojson` / `route_farmer.geojson` / `web/public/layers/` stay on the 311-tile stitch until you export after **all jobs are submitted**.

6. **Web UI.** [https://dementra.md](https://dementra.md) (also [http://127.0.0.1:43173](http://127.0.0.1:43173)). Inspector (blue, 7.99 km) and farmer (red, 4.29 km), canopy 1.2239 ha, inter-row 7.0928 ha, 36,943 m of rows. Badge reads **MARCAJ**.

## Sireț3 imagery

| | |
| --- | --- |
| OpenAerialMap | [Sireț3 STAC item](https://api.imagery.hotosm.org/stac/collections/openaerialmap/items/683060c4025981aa411253c8) |
| Date | 20 May 2025 (UTC) |
| GSD | 3.52 cm/px on the source ortho (resolution, not accuracy). Challenge tiles are 2.5 cm/px |
| Sensor | UAV / Mavic 3E, 3DATA COLLECT |
| Area | ~145 ha / 1.45 km² (OAM alpha mask). 3.32 km² bbox includes empty margins |
| Source file | 658.6 MB RGB GeoTIFF, EPSG:4326, 70,246 × 81,986 px |
| Licence | CC BY 4.0, producer 3DATA COLLECT |
| XYZ | `https://api.imagery.hotosm.org/raster/collections/openaerialmap/items/683060c4025981aa411253c8/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=visual` |

Attribute: 3DATA COLLECT / Open Imagery Network, CC BY 4.0.

## Paid APIs

None required. If you later use Ultralytics Platform, Roboflow train, Replicate, or Hugging Face Inference, list the name and cost here before the pitch.

## Licences we actually touch

- Ultralytics YOLO: AGPL-3.0 (repo is public)
- SAM / SAM2 / MobileSAM: Apache-2.0
- Riseholme COCO (Zenodo): CC-BY-4.0
- DroneWaste dataset: CC-BY-4.0
- Sireț3: CC-BY-4.0

AGRIDS YOLO zip and the Kaggle Riseholme mirror are **NC / ND**. Do not use them.

## Status

- Path generator: `siret3 route` (inspector + farmer). Both files at repo root, EPSG:32635, closed at 629504.70, 5220250.75.
- Web: [https://dementra.md](https://dementra.md). No paid APIs.
- Weights: tracked `vineyard.pt` / `waste.pt` + [v0.1.0 release](https://github.com/CristianProdius/bei50/releases/tag/v0.1.0).
- Hardware: NVIDIA H100 80 GB for train/infer; Mac for GIS, walks, and the Next.js map.
- Still human: correct and **submit every Marcaj job**, then re-run step 5 on a full export. Tile ZIPs and the source ortho stay gitignored.
