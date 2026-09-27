# Organizer repo contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GitHub repo satisfy the 15:00 organizer checklist: root `route.geojson`, root `measurements.csv`, a README that runs tiles → those two files with time/hardware/weights, and pinned dependencies plus a Dockerfile.

**Architecture:** The two scored files already exist and are legal. Do not rebuild walks or move the official start. Put score-card rows first in the CSV, pin the processing lockfile, and rewrite the README so a jury member can reproduce `route.geojson` + `measurements.csv` without reading AGENTS.md.

**Tech Stack:** Python 3.12, `siret3` CLI (`processing/`), pinned pip requirements, root `Dockerfile`, Next.js lockfile already present in `web/`.

---

## Files

| File | Role |
| --- | --- |
| `route.geojson` | Do not edit. Already one closed LineString EPSG:32635, start 629504.70, 5220250.75, `length_m` 7991.683 |
| `measurements.csv` | Reorder only: five score-card kinds first, then per-object rows. Same numbers |
| `processing/src/siret3/measurements.py` | `write_csv` writes `summary_rows` first |
| `processing/tests/test_measurements.py` | Summary-first test |
| `processing/tests/test_repo_deliverables.py` | Root file contract |
| `processing/requirements.txt` | Full pinned lock from the local venv |
| `processing/pyproject.toml` | Pin direct deps to those versions |
| `Dockerfile` | Install from the lockfile |
| `README.md` | Jury-first: tiles → both files, time, hardware, weights |
| `docs/challenge.md` | Delete the stale “sample route” paragraph only |

Do **not** change `route.geojson` start, rebuild walks, retrain, or label Sireț3.

---

### Task 1: Pin processing deps and Dockerfile

**Files:**
- Create: `processing/requirements.txt`
- Create: `requirements.txt` (repo root, one line `-r processing/requirements.txt`)
- Modify: `processing/pyproject.toml`
- Modify: `Dockerfile`

**Pinned versions (from the local processing venv, 27 Sep 2026):**

```
affine==3.0.1
attrs==26.1.0
certifi==2026.7.22
click==8.5.0
geopandas==1.1.4
lxml==6.1.3
networkx==3.7
numpy==2.5.3
packaging==26.3
pandas==3.0.6
pillow==12.3.0
pyogrio==0.13.0
pyparsing==3.3.3
pyproj==3.8.0
python-dateutil==2.9.0.post0
rasterio==1.5.1
shapely==2.1.2
six==1.17.0
```

Dev extras stay in pyproject: `pytest==9.1.1` (plus `iniconfig==2.3.0`, `pluggy==1.6.0`, `Pygments==2.21.0` if you include a `requirements-dev.txt`).

- [ ] **Step 1:** Write `processing/requirements.txt` with the runtime pins above (no pytest, no `-e siret3`).
- [ ] **Step 2:** Write root `requirements.txt` containing only `-r processing/requirements.txt`.
- [ ] **Step 3:** Change `processing/pyproject.toml` direct deps to exact `==` versions: rasterio 1.5.1, geopandas 1.1.4, shapely 2.1.2, pyproj 3.8.0, networkx 3.7, numpy 2.5.3, lxml 6.1.3. Dev: `pytest==9.1.1`.
- [ ] **Step 4:** Replace root `Dockerfile` with:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY processing/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY processing /app/processing
RUN pip install --no-cache-dir --no-deps -e /app/processing
WORKDIR /work
ENTRYPOINT ["siret3"]
CMD ["--help"]
```

Do not install `gdal-bin` / `libgdal-dev` (rasterio wheels ship GDAL).

- [ ] **Step 5:** Commit on this worktree branch:

```
Pin processing dependencies and install them from the root Dockerfile.
```

---

### Task 2: Score-card CSV first + repo contract tests

**Files:**
- Modify: `processing/src/siret3/measurements.py` (`write_csv`)
- Modify: `processing/tests/test_measurements.py`
- Create: `processing/tests/test_repo_deliverables.py`
- Modify: `measurements.csv` (reorder rows only)

`write_csv` today is:

```python
rows = [measure(item) for item in items] + summary_rows(items)
```

Change to:

```python
rows = summary_rows(items) + [measure(item) for item in items]
```

Official start stays `(629504.70, 5220250.75)`.

- [ ] **Step 1: Write the failing tests** (do not change production code yet).

Add to `processing/tests/test_measurements.py`:

```python
def test_write_csv_puts_scorecard_summaries_first(tmp_path):
    import csv
    out = tmp_path / "measurements.csv"
    write_csv(
        [
            _sq(0, 0, 10, 10),
            ProjectedPoly(
                kind="row",
                vineyard_id="V01",
                row_id="V01-R01",
                coords=[(0, 0), (10, 0)],
                tile="t1.tif",
            ),
        ],
        out,
    )
    kinds = [row["kind"] for row in csv.DictReader(out.open())]
    assert kinds[:5] == [
        "n_blocks",
        "n_rows",
        "canopy_union",
        "interrow_union",
        "total_row_length",
    ]
    assert "vineyard" in kinds
    assert "row" in kinds
```

Create `processing/tests/test_repo_deliverables.py` with tests that:

1. Root `route.geojson` is one Feature, LineString, CRS `EPSG:32635`, has `length_m` > 0, first and last vertex within 5 m of `(629504.70, 5220250.75)`, easting > 1000 (not lon/lat).
2. Root `measurements.csv` contains kinds `n_blocks`, `n_rows`, `canopy_union`, `interrow_union`, `total_row_length` as the first five data rows, and at least one `vineyard_id` appears on more than one `tile_names` value.

`REPO = Path(__file__).resolve().parents[2]`.

- [ ] **Step 2:** Run with the existing venv (do not create a new one):

```bash
/Users/cristian/Development/gigahack2026/bei50/processing/.venv/bin/python -m pytest -q \
  tests/test_measurements.py::test_write_csv_puts_scorecard_summaries_first \
  tests/test_repo_deliverables.py
```

Expected: FAIL (summaries still last; root CSV still ends with the five kinds).

- [ ] **Step 3:** Flip `write_csv` to `summary_rows(items) + [measure(item) for item in items]`.

- [ ] **Step 4:** Reorder root `measurements.csv` without changing numbers: header, then the five summary rows, then all other rows. Do not recompute areas.

- [ ] **Step 5:** Re-run the two tests. Expected: PASS.

- [ ] **Step 6:** Run full `processing/` pytest with the same venv. Expected: all pass.

- [ ] **Step 7:** Commit:

```
Put jury measurement summaries first and lock the root deliverable files in pytest.
```

---

### Task 3: Jury README (tiles → both files)

**Files:**
- Modify: `README.md`
- Modify: `docs/challenge.md` (delete only the stale “Current repo gaps vs this brief” paragraph that still says the route is a 4326 sample)

Lead the README with the organizer list. A stranger must be able to go from tiles to `route.geojson` + `measurements.csv`.

Required content (use these facts, do not invent new timings):

- Live UI: https://dementra.md
- Weights in-repo: `models/weights/vineyard.pt`, `models/weights/waste.pt`
- Same files: https://github.com/CristianProdius/bei50/releases/tag/v0.1.0
- Hardware: NVIDIA H100 80 GB for train/infer; Apple silicon Mac for GIS + walks + Next.js
- Times: waste train 60 epochs on one H100; `infer_311.sh` finished 26 Sep ~01:05 (311 canopy + 311 waste); stitch + both walks ~3 minutes on the Mac
- Current root numbers (311-tile stitch, planar EPSG:32635): n_blocks 1253, n_rows 2234, canopy 12238.874 m² / 1.223887 ha, inter-row 70927.676 m² / 7.092768 ha, row length 36943.064 m
- Inspector `route.geojson`: 7991.683 m, closed at 629504.70, 5220250.75
- Farmer `route_farmer.geojson` stays in the repo (waste-only) but is not the 25% file
- Official start must not be moved to the pretest point 629663.8, 5220195.3
- Pinned install: `pip install -r processing/requirements.txt` then `pip install --no-deps -e processing`
- Docker: `docker build -t siret3 .` then `docker run --rm -v "$PWD:/work" -w /work siret3 measurements /work/data/stitched.geojson --out /work/measurements.csv`
- Paid APIs: none

From-tiles commands to include:

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

Keep a short Marcaj / web section after that. Do not write slides.

- [ ] **Step 1:** Rewrite `README.md` with the section order: title + dementra.md → repo must contain → from tiles to both files → time/hardware → weights → pinned deps/Docker → then shorter existing context.
- [ ] **Step 2:** Remove the stale “Current repo gaps vs this brief” paragraph in `docs/challenge.md` (the one that says sample `route.geojson` is EPSG:4326).
- [ ] **Step 3:** Commit:

```
Rewrite the README so tiles produce the two organizer deliverable files.
```

---

## Self-review

1. Spec: (1) route file already legal, tested not rebuilt. (2) measurements kinds + one vineyard_id across tiles, summaries first. (3) README run/time/hardware/weights. (4) pinned reqs + Dockerfile.
2. No placeholders.
3. Official start coordinates match Task 2 and Task 3.
