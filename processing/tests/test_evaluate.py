"""Plant / waste scoring against ground truth."""

import json
from pathlib import Path

from siret3.cvat11 import CvatImage, CvatShape
from siret3.evaluate import evaluate


def _sq(x, y, s=20):
    return [(x, y), (x + s, y), (x + s, y + s), (x, y + s)]


def test_evaluate_plants_and_waste(tmp_path: Path):
    gt = CvatImage(name="1_siret3_r000_c000.tif", width=100, height=100, shapes=[
        CvatShape(tag="polygon", label="vineyard", points=_sq(0, 0)),
        CvatShape(tag="polygon", label="vineyard", points=_sq(50, 50)),
        CvatShape(tag="box", label="waste", xtl=80, ytl=0, xbr=90, ybr=10),
    ])
    other = CvatImage(name="siret3_r009_c009.tif", width=100, height=100, shapes=[
        CvatShape(tag="polygon", label="vineyard", points=_sq(0, 0))])
    feats = [
        {"type": "Feature", "properties": {"kind": "vineyard", "score": 0.9},
         "geometry": {"type": "Polygon", "coordinates": [[*map(list, _sq(1, 1)), [1, 1]]]}},
        {"type": "Feature", "properties": {"kind": "vineyard", "score": 0.8},
         "geometry": {"type": "Polygon", "coordinates": [[*map(list, _sq(20, 80, 10)), [20, 80]]]}},
        {"type": "Feature", "properties": {"kind": "waste", "score": 0.5},
         "geometry": {"type": "Polygon", "coordinates": [[[81, 0], [90, 0], [90, 10], [81, 10], [81, 0]]]}},
    ]
    (tmp_path / "siret3_r000_c000.geojson").write_text(json.dumps({"features": feats}))
    split = {"siret3_r000_c000.tif": "test", "siret3_r009_c009.tif": "train"}
    rep = evaluate([gt, other], split, "test", plants_dir=tmp_path, waste_dir=tmp_path)
    assert rep["tiles"] == 1
    assert rep["plants"]["tp"] == 1 and rep["plants"]["gt"] == 2 and rep["plants"]["pred"] == 2
    assert rep["plants"]["f1"] == 0.5
    assert rep["waste"]["recall"] == 1.0


def test_evaluate_rows_and_interrows(tmp_path: Path):
    gt = CvatImage(name="siret3_r000_c000.tif", width=2048, height=2048, shapes=[
        CvatShape(tag="polyline", label="row", points=[(100, 100), (1900, 100)],
                  attributes={"row_structure": "disrupted"}),
        CvatShape(tag="polyline", label="row", points=[(100, 200), (1900, 200)],
                  attributes={"row_structure": "regular"}),
        CvatShape(tag="polygon", label="interrow_area",
                  points=[(100, 120), (1900, 120), (1900, 180), (100, 180)],
                  attributes={"interrow_cover": "mixed"}),
    ])
    feats = [
        {"type": "Feature", "properties": {"kind": "row", "row_structure": "disrupted"},
         "geometry": {"type": "LineString", "coordinates": [[110, 102], [1880, 101]]}},
        {"type": "Feature", "properties": {"kind": "row", "row_structure": "disrupted"},
         "geometry": {"type": "LineString", "coordinates": [[110, 201], [1880, 199]]}},
        {"type": "Feature", "properties": {"kind": "interrow_area", "interrow_cover": "mixed"},
         "geometry": {"type": "Polygon", "coordinates": [[[100, 125], [1900, 125], [1900, 180], [100, 180], [100, 125]]]}},
    ]
    (tmp_path / "siret3_r000_c000.geojson").write_text(json.dumps({"features": feats}))
    rep = evaluate([gt], {"siret3_r000_c000.tif": "val"}, "val", semseg_dir=tmp_path)
    assert rep["rows"]["f1"] == 1.0
    assert rep["rows"]["structure_acc"] == 0.5
    assert rep["interrows"]["cover_acc"] == 1.0
    assert 0.9 < rep["interrows"]["area_iou"] <= 1.0
