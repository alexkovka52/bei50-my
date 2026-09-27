"""Organizer pre-test point. Do not move the official walk start."""

from __future__ import annotations

import json
import math
from pathlib import Path

from shapely.geometry import Point, shape

from siret3.crs import from_work_xy

REPO = Path(__file__).resolve().parents[2]
OFFICIAL_START = (629504.70, 5220250.75)
PRETEST = (629663.8, 5220195.3)
PRETEST_WGS84 = (28.7094577, 47.1225039)  # lon, lat


def _line_coords(path: Path) -> list[tuple[float, float]]:
    data = json.loads(path.read_text())
    feat = data["features"][0]
    return [(float(x), float(y)) for x, y in feat["geometry"]["coordinates"]]


def _nearest_m(pt: tuple[float, float], coords: list[tuple[float, float]]) -> float:
    return min(math.hypot(x - pt[0], y - pt[1]) for x, y in coords)


def test_pretest_utm_matches_given_wgs84():
    lon, lat = from_work_xy(*PRETEST)
    assert abs(lon - PRETEST_WGS84[0]) < 1e-5
    assert abs(lat - PRETEST_WGS84[1]) < 1e-5


def test_pretest_point_inside_study_area():
    study = json.loads((REPO / "data/challenge/02_route/study_area.geojson").read_text())
    poly = shape(study["features"][0]["geometry"])
    assert poly.contains(Point(*PRETEST))


def test_submitted_routes_still_close_at_official_start():
    for name in ("route.geojson", "route_farmer.geojson"):
        coords = _line_coords(REPO / name)
        first, last = coords[0], coords[-1]
        assert math.hypot(first[0] - OFFICIAL_START[0], first[1] - OFFICIAL_START[1]) <= 5.0
        assert math.hypot(last[0] - OFFICIAL_START[0], last[1] - OFFICIAL_START[1]) <= 5.0
        assert first[0] > 1000


def test_pretest_nearest_walk_distance_is_logged(capsys):
    inspector = _line_coords(REPO / "route.geojson")
    farmer = _line_coords(REPO / "route_farmer.geojson")
    d_ins = _nearest_m(PRETEST, inspector)
    d_far = _nearest_m(PRETEST, farmer)
    print(f"pretest nearest inspector_m={d_ins:.2f} farmer_m={d_far:.2f}")
    assert d_ins >= 0.0
    assert d_far >= 0.0
    captured = capsys.readouterr()
    assert "inspector_m=" in captured.out
