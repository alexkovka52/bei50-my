# gigahack-bei50

Sireț3 vineyard map for the Marcaj Vineyard AI Field Challenge. Live UI: [https://dementra.md](https://dementra.md).

Deadline: Sunday 27 Sep 2026, 15:00 Europe/Chisinau. Marcaj is the scored annotation source. Organizers export it at the deadline. This repository ships the walks, the measurement table, the code, and the weights.

## Repo must contain

- **`route.geojson`** — inspector walk, the 25% route file. One LineString in EPSG:32635, `length_m` **7991.683**, closed at the official start **629504.70, 5220250.75**. Keep that start. The pretest point 629663.8, 5220195.3 is a different coordinate and must not replace it.
- **`measurements.csv`** — planar EPSG:32635 totals from the current 311-tile stitch: **1253** blocks, **2234** rows, canopy **12238.874 m²** (1.223887 ha), inter-row **70927.676 m²** (7.092768 ha), row length **36943.064 m**.
- **`route_farmer.geojson`** — farmer walk, waste only (4293.173 m, same official start). It stays in the repo. The 25% score reads `route.geojson`.
- **Code and weights.** `models/weights/vineyard.pt` and `models/weights/waste.pt` are in the repo. The same files are on the [v0.1.0 release](https://github.com/CristianProdius/bei50/releases/tag/v0.1.0). Paid APIs: none.

## From tiles to both files

Unzip the challenge tiles, install the pinned processing package, run canopy and waste inference, then write root `measurements.csv` and inspector `route.geojson`.

Canopy and waste inference import Ultralytics. In the same venv, `pip install ultralytics` before the two `infer_yolo.py` lines. If that import fails, the script writes empty GeoJSON and the root files will not match the numbers above.

```bash
unzip 'data/challenge/01_tiles/siret3_challenge_tiles_part*.zip' -d data/tiles

cd processing && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install --no-deps -e .

python ../models/infer_yolo.py --weights ../models/weights/vineyard.pt --tiles ../data/tiles --out ../data/predictions
python ../models/infer_yolo.py --weights ../models/weights/waste.pt --tiles ../data/tiles --out ../data/predictions_waste --conf 0.4

siret3 project ../data/predictions ../data/predictions_waste --tiles ../data/tiles --out ../data/predictions_32635.geojson
siret3 stitch ../data/predictions_32635.geojson --tiles ../data/tiles --passages ../data/challenge/02_route/passages.geojson --out ../data/stitched.geojson
siret3 inspect ../data/stitched.geojson --out ../inspections.geojson
siret3 measurements ../data/stitched.geojson --out ../measurements.csv
siret3 route ../data/stitched.geojson --targets inspections,waste \
  --start-file ../data/challenge/02_route/start.geojson \
  --passages ../data/challenge/02_route/passages.geojson \
  --forbidden ../data/challenge/02_route/forbidden.geojson \
  --out ../route.geojson
```

The farmer file uses the same graph and the official start, with waste targets only:

```bash
siret3 route ../data/stitched.geojson --targets waste \
  --start-file ../data/challenge/02_route/start.geojson \
  --passages ../data/challenge/02_route/passages.geojson \
  --forbidden ../data/challenge/02_route/forbidden.geojson \
  --out ../route_farmer.geojson
```

## Time and hardware

- **Train and infer:** NVIDIA H100 80 GB. Waste training was 60 epochs on one H100. `infer_311.sh` finished 26 Sep ~01:05 (311 canopy tiles and 311 waste tiles).
- **GIS, both walks, and the Next.js map:** Apple silicon Mac. Stitch plus both walks took about 3 minutes.
- **Paid APIs:** none.

## Weights

| File | What it is |
| --- | --- |
| `models/weights/vineyard.pt` | YOLO11m-seg canopy, Riseholme. Mask mAP50 on that val set was about 0.73. |
| `models/weights/waste.pt` | YOLO12 detect, DroneWaste, 60 epochs. Box mAP50 0.394. Infer with `--conf 0.4`. |

Same files: [github.com/CristianProdius/bei50/releases/tag/v0.1.0](https://github.com/CristianProdius/bei50/releases/tag/v0.1.0).

```bash
mkdir -p models/weights
curl -L -o models/weights/vineyard.pt https://github.com/CristianProdius/bei50/releases/download/v0.1.0/vineyard.pt
curl -L -o models/weights/waste.pt https://github.com/CristianProdius/bei50/releases/download/v0.1.0/waste.pt
```

## Pinned dependencies and Docker

From the repo root, with the processing venv active:

```bash
pip install -r processing/requirements.txt
pip install --no-deps -e processing
```

The tile recipe above is the same pin from inside `processing/` (`pip install -r requirements.txt`, then `pip install --no-deps -e .`).

Docker, once `data/stitched.geojson` exists:

```bash
docker build -t siret3 .
docker run --rm -v "$PWD:/work" -w /work siret3 measurements /work/data/stitched.geojson --out /work/measurements.csv
```

## Marcaj

Scored Sireț3 labels are drawn only in Marcaj. Upload CVAT for images 1.1 with the supplied GeoTIFF names, at most 90 MB per ZIP, all 311 tiles, then publish. Submit every job. Only submitted jobs are scored.

Root `route.geojson`, `route_farmer.geojson`, and `measurements.csv` are the 311-tile stitch in EPSG:32635 (horizontal only, no DEM), with the totals in the list above.

## Web

[https://dementra.md](https://dementra.md) shows both walks (inspector in blue, farmer in red), block and row IDs, and the measurement totals.

```bash
cd web
npm install
npm run dev
```

Local: [http://127.0.0.1:43173](http://127.0.0.1:43173). Imagery credit: 3DATA COLLECT / OpenAerialMap, CC BY 4.0.

## Licences

- Ultralytics YOLO: AGPL-3.0. This repository is public.
- Riseholme COCO and DroneWaste: CC BY 4.0.
- Sireț3 imagery: CC BY 4.0, credit 3DATA COLLECT / OpenAerialMap.
- Authorised passages include OpenStreetMap data (ODbL).

AGRIDS and the Kaggle Riseholme mirror are NC / ND. Do not use them.

Further reading: [docs/challenge.md](docs/challenge.md), [docs/scoring.md](docs/scoring.md), [docs/annotation-rules.md](docs/annotation-rules.md), [docs/siret3-dataset.md](docs/siret3-dataset.md), [AGENTS.md](AGENTS.md).
