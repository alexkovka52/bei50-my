"""Organizer 15:00 repo contract: root route.geojson + measurements.csv."""
from __future__ import annotations
import csv, json, math
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OFFICIAL_START = (629504.70, 5220250.75)
SCORECARD = (
    "n_blocks", "n_rows", "canopy_union", "interrow_union", "total_row_length",
)

def test_root_route_is_one_closed_linestring_epsg32635():
    data = json.loads((REPO / "route.geojson").read_text())
    assert data["crs"]["properties"]["name"] == "EPSG:32635"
    assert len(data["features"]) == 1
    feat = data["features"][0]
    assert feat["geometry"]["type"] == "LineString"
    assert "length_m" in feat["properties"]
    assert float(feat["properties"]["length_m"]) > 0
    coords = feat["geometry"]["coordinates"]
    first, last = coords[0], coords[-1]
    assert math.hypot(first[0] - OFFICIAL_START[0], first[1] - OFFICIAL_START[1]) <= 5.0
    assert math.hypot(last[0] - OFFICIAL_START[0], last[1] - OFFICIAL_START[1]) <= 5.0
    assert first[0] > 1000

def test_root_measurements_csv_has_scorecard_and_vineyard_ids():
    rows = list(csv.DictReader((REPO / "measurements.csv").open()))
    kinds = [row["kind"] for row in rows]
    for name in SCORECARD:
        assert name in kinds
    assert kinds[:5] == list(SCORECARD)
    vineyard_rows = [row for row in rows if row["kind"] == "vineyard" and row["vineyard_id"]]
    assert vineyard_rows
    by_id = {}
    for row in vineyard_rows:
        by_id.setdefault(row["vineyard_id"], set()).add(row["tile_names"])
    assert any(len(tiles) > 1 for tiles in by_id.values())
