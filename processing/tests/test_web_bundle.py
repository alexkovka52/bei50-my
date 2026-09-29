"""Synthetic checks for the Dementra web bundle. No real tiles."""

import json
from pathlib import Path

from siret3.cli import main
from siret3.ids import ProjectedPoly
from siret3.web_bundle import build_bundle, write_bundle

X0 = 629000.0
# Separate northings so a plant cannot snap onto another block's row (1.5 m).
Y = {
    "M": 5220100.0,
    "A": 5220400.0,
    "U": 5220700.0,
    "F": 5221000.0,
    "VA": 5221500.0,
    "VB": 5222000.0,
}


def _row(vid, rid, x0, x1, y, structure="regular"):
    return ProjectedPoly(
        kind="row",
        vineyard_id=vid,
        row_id=rid,
        row_structure=structure,
        coords=[(x0, y), (x1, y)],
        tile="siret3_r001_c001.tif",
    )


def _plant(vid, x, y, size=0.4):
    return ProjectedPoly(
        kind="vineyard",
        vineyard_id=vid,
        coords=[(x - size, y - size), (x + size, y - size), (x + size, y + size), (x - size, y + size)],
        tile="siret3_r001_c001.tif",
    )


def _waste(vid, x, y):
    return ProjectedPoly(
        kind="waste",
        vineyard_id=vid,
        coords=[(x, y), (x + 0.6, y), (x + 0.6, y + 0.6), (x, y + 0.6)],
        tile="siret3_r001_c001.tif",
    )


def _interrow(vid, x, y, cover, size=10.0):
    return ProjectedPoly(
        kind="interrow_area",
        vineyard_id=vid,
        interrow_cover=cover,
        coords=[(x, y), (x + size, y), (x + size, y + size), (x, y + size)],
        tile="siret3_r001_c001.tif",
    )


def _bundle(items, **kwargs):
    defaults = dict(
        routes={},
        passages=None,
        forbidden=None,
        baseline=None,
        now=None,
        source="marcaj-labels",
        flown_on="2026-09-20",
        generated_at="2026-09-29T00:00:00Z",
        split={"counts": {"train": 1, "val": 2, "test": 3}},
    )
    defaults.update(kwargs)
    return build_bundle(items, **defaults)


def _walk(coords):
    if isinstance(coords, (int, float)):
        return
    if coords and isinstance(coords[0], (int, float)):
        lon, lat = float(coords[0]), float(coords[1])
        assert 28.0 < lon < 29.5, lon
        assert 46.5 < lat < 47.8, lat
        assert abs(lon - round(lon, 7)) < 1e-6
        assert abs(lat - round(lat, 7)) < 1e-6
        return
    for part in coords:
        _walk(part)


def test_blocks_rank_by_length_remap_ids_and_drop_fragments():
    items = [
        _row("M", "M-R32", X0, X0 + 100, Y["M"], "regular"),
        _row("M", "M-R32", X0 + 100, X0 + 200, Y["M"], "regular"),
        _row("M", "M-R32", X0 + 200, X0 + 300, Y["M"], "disrupted"),
        _row("A", "A-R7", X0, X0 + 125, Y["A"], "regular"),
        _row("A", "A-R7", X0 + 125, X0 + 250, Y["A"], "disrupted"),
        _row("U", "U-R1", X0, X0 + 200, Y["U"], "unassessable"),
        _row("S", "S-R2", X0, X0 + 199, Y["F"] + 400, "regular"),
        _row("F", "F-R4", X0, X0 + 40, Y["F"], "regular"),
        _plant("M", X0 + 10, Y["M"]),
        _plant("F", X0 + 5, Y["F"]),
        _waste("F", X0 + 8, Y["F"] + 3),
        _interrow("M", X0, Y["M"] + 5, "bare_soil"),
        _interrow("M", X0 + 20, Y["M"] + 5, None),
    ]
    bundle = _bundle(items)
    summary = bundle["summary.json"]
    assert summary["version"] == 1
    assert summary["farm"] == "Sireț3 vineyard"
    assert summary["area_ha"] == 145
    assert summary["tiles"] == 311
    assert summary["gsd_m"] == 0.025
    assert summary["flown_on"] == "2026-09-20"
    assert summary["source"] == "marcaj-labels"
    assert summary["counts"]["blocks"] == 3
    # Distinct row ids: V01, V02, V03, plus the 199 m and 40 m fragments.
    assert summary["counts"]["rows"] == 5
    assert summary["counts"]["row_pieces"] == 8
    assert summary["counts"]["plants"] == 2
    assert summary["counts"]["waste"] == 1
    assert summary["counts"]["gaps"] == 0
    assert summary["row_km"] == 0.99  # 989 m
    assert set(summary["cover"]) == {"bare_soil", "vegetation", "mixed", "unassessable", "unset"}
    assert summary["cover"]["bare_soil"] == 1
    assert summary["cover"]["unset"] == 1
    assert summary["structure"]["regular"] == 5  # M×2, A×1, S, F
    assert summary["structure"]["disrupted"] == 2
    assert summary["structure"]["unassessable"] == 1

    blocks = bundle["blocks.json"]["blocks"]
    assert [b["id"] for b in blocks] == ["V01", "V02", "V03"]
    assert [b["row_km"] for b in blocks] == [0.3, 0.25, 0.2]
    by_id = {b["id"]: b for b in blocks}
    assert by_id["V01"]["rows"] == 1
    assert by_id["V01"]["plants"] == 1
    assert by_id["V01"]["disrupted_pct"] == 33  # 1 disrupted / 3 assessed pieces
    assert by_id["V02"]["disrupted_pct"] == 50
    assert by_id["V03"]["disrupted_pct"] is None
    assert by_id["V01"]["cover"]["bare_soil"] == 1
    assert by_id["V01"]["cover"]["unset"] == 1
    assert by_id["V01"]["largest_gaps"] == []
    assert "S" not in by_id and "F" not in by_id

    rows = {r["id"]: r for r in bundle["rows.json"]["rows"]}
    assert rows["V01-R032"]["block"] == "V01"
    assert rows["V01-R032"]["row"] == 32
    assert rows["V01-R032"]["pieces"] == 3
    assert rows["V01-R032"]["structure"] == "disrupted"
    assert rows["V01-R032"]["length_m"] == 300.0
    assert rows["V02-R007"]["row"] == 7
    assert rows["V03-R001"]["block"] == "V03"
    assert rows["X-R004"]["block"] is None
    assert rows["X-R002"]["block"] is None  # S-R2, fragment

    plants = bundle["layers/plants.geojson"]["features"]
    assert {p["properties"]["block"] for p in plants} == {"V01", None}
    assert all(set(p["properties"]) == {"block"} for p in plants)
    waste = bundle["layers/waste.geojson"]["features"]
    assert waste[0]["properties"]["block"] is None
    assert waste[0]["properties"]["id"] == "WASTE-X-001"
    tasks = bundle["tasks.json"]["tasks"]
    assert len(tasks) == 1
    assert tasks[0]["id"] == "WASTE-X-001"
    assert tasks[0]["block"] is None
    assert tasks[0]["kind"] == "waste"
    assert tasks[0]["priority"] == 1


def test_tasks_order_waste_after_large_gaps():
    va_y = Y["VA"]
    vb_y = Y["VB"]
    # Along VA: gaps of 38, 13, 23 and 18 m. VB: one 48 m gap.
    va_plants = [629000, 629002, 629040, 629042, 629055, 629057, 629080, 629082, 629100, 629102]
    items = [
        _row("VA", "VA-R1", 629000, 629250, va_y),
        _row("VB", "VB-R5", 629000, 629220, vb_y),
        *[_plant("VA", x, va_y) for x in va_plants],
        *[_plant("VB", x, vb_y) for x in (629000, 629002, 629050, 629052)],
        _waste("VB", 629010, vb_y + 4),
        _waste("VB", 629030, vb_y + 4),
        _waste("VA", 629010, va_y + 4),
    ]
    bundle = _bundle(items)
    tasks = bundle["tasks.json"]["tasks"]
    assert [t["id"] for t in tasks] == [
        "GAP-V02-R005-01",
        "GAP-V01-R001-01",
        "GAP-V01-R001-03",
        "WASTE-V02-001",
        "WASTE-V02-002",
        "WASTE-V01-001",
        "GAP-V01-R001-04",
        "GAP-V01-R001-02",
    ]
    assert [t["priority"] for t in tasks] == list(range(1, 9))
    by_id = {t["id"]: t for t in tasks}
    assert by_id["GAP-V02-R005-01"]["gap_m"] == 48.0
    assert by_id["GAP-V02-R005-01"]["block"] == "V02"
    assert by_id["GAP-V02-R005-01"]["row"] == 5
    assert by_id["GAP-V01-R001-02"]["gap_m"] == 13.0
    assert by_id["WASTE-V02-001"]["kind"] == "waste"
    assert by_id["WASTE-V02-001"]["gap_m"] is None
    assert by_id["WASTE-V02-001"]["row_id"] is None
    v01 = next(b for b in bundle["blocks.json"]["blocks"] if b["id"] == "V01")
    assert [g["gap_m"] for g in v01["largest_gaps"]] == [38.0, 23.0, 18.0]
    assert v01["largest_gaps"][0]["row_id"] == "V01-R001"
    assert v01["gaps"] == 4
    assert v01["waste"] == 1
    assert 28.0 < by_id["GAP-V01-R001-01"]["at"][0] < 29.5
    assert 46.5 < by_id["GAP-V01-R001-01"]["at"][1] < 47.8


def test_layers_are_wgs84_with_seven_decimals():
    y = 5220200.0
    items = [
        _row("B", "B-R3", X0, X0 + 210, y, "regular"),
        _plant("B", X0 + 1, y),
        _plant("B", X0 + 12, y),
        _waste("B", X0 + 20, y + 4),
        _interrow("B", X0, y + 3, "vegetation", size=20),
    ]
    passages = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"type": "passage"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [X0, y + 30],
                        [X0 + 15, y + 30],
                        [X0 + 15, y + 40],
                        [X0, y + 40],
                        [X0, y + 30],
                    ]],
                },
            }
        ],
    }
    forbidden = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"type": "forbidden"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [X0 + 40, y + 30],
                        [X0 + 50, y + 30],
                        [X0 + 50, y + 40],
                        [X0 + 40, y + 40],
                        [X0 + 40, y + 30],
                    ]],
                },
            }
        ],
    }
    bundle = _bundle(items, passages=passages, forbidden=forbidden)
    for name in ("plants", "rows", "interrows", "gaps", "waste", "blocks", "passages", "forbidden"):
        fc = bundle[f"layers/{name}.geojson"]
        assert fc["type"] == "FeatureCollection"
        assert fc["features"], name
        for feat in fc["features"]:
            _walk(feat["geometry"]["coordinates"])
    row = bundle["layers/rows.geojson"]["features"][0]["properties"]
    assert row == {"id": "V01-R003", "block": "V01", "structure": "regular"}
    inter = bundle["layers/interrows.geojson"]["features"][0]["properties"]
    assert inter["cover"] == "vegetation"
    assert inter["block"] == "V01"
    block = bundle["layers/blocks.geojson"]["features"][0]
    assert set(block["properties"]) == {"id", "rows", "row_km", "gaps", "waste"}
    assert block["geometry"]["type"] in {"Polygon", "MultiPolygon"}
    assert bundle["layers/passages.geojson"]["features"][0]["properties"]["kind"] == "passage"
    assert bundle["layers/forbidden.geojson"]["features"][0]["properties"]["kind"] == "forbidden"
    gap = bundle["layers/gaps.geojson"]["features"][0]["properties"]
    assert set(gap) == {"id", "block", "row_id", "gap_m"}
    assert gap["gap_m"] == 11.0


def test_model_metrics_map_eval_fields_including_nulls():
    items = [
        _row("B", "B-R1", X0, X0 + 210, 5220200.0),
        _plant("B", X0 + 1, 5220200.0),
        _waste("B", X0 + 4, 5220204.0),
        _interrow("B", X0, 5220210.0, "mixed"),
    ]
    baseline = {
        "plants": {"f1": 0.3075},
        "waste": {"tp": 2, "gt": 7},
        "rows": {"f1": 0.5},
        "interrows": {},
    }
    now = {
        "plants": {"f1": 0.8},
        "rows": {"structure_acc": 0.855},
        "interrows": {"cover_acc": 0.5},
    }
    model = _bundle(items, baseline=baseline, now=now)["model.json"]
    assert model["dataset"]["tiles"] == 311
    assert model["dataset"]["plants"] == 1
    assert model["dataset"]["rows"] == 1
    assert model["dataset"]["interrows"] == 1
    assert model["dataset"]["waste"] == 1
    assert model["dataset"]["split"] == {"train": 1, "val": 2, "test": 3}
    metrics = {m["key"]: m for m in model["metrics"]}
    assert [m["key"] for m in model["metrics"]] == [
        "plant_f1",
        "waste_found",
        "rows_f1",
        "structure_acc",
        "cover_acc",
    ]
    assert metrics["plant_f1"]["label"] == "Plants found correctly (F1)"
    assert metrics["plant_f1"]["before"] == "0.31"
    assert metrics["plant_f1"]["now"] == "0.80"
    assert metrics["waste_found"]["before"] == "2 of 7"
    assert metrics["waste_found"]["now"] is None
    assert metrics["rows_f1"]["before"] == "0.50"
    assert metrics["rows_f1"]["now"] is None
    assert metrics["structure_acc"]["before"] is None
    assert metrics["structure_acc"]["now"] == "85.5%"
    assert metrics["cover_acc"]["before"] is None
    assert metrics["cover_acc"]["now"] == "50%"

    empty = _bundle(items, baseline=None, now=None)["model.json"]["metrics"]
    assert all(m["before"] is None and m["now"] is None for m in empty)


def test_routes_pass_through_measured_properties():
    inspector = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "length_m": 7991.683,
                    "role": "inspector",
                    "targets_total": 12,
                    "kind": "route",
                    "start_x": 629504.7,
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[629504.7, 5220250.75], [629520.0, 5220260.0], [629504.7, 5220250.75]],
                },
            }
        ],
    }
    farmer = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"length_m": 100.5, "role": "farmer", "targets_total": 4, "targets_visited": 3},
                "geometry": {"type": "LineString", "coordinates": [[28.71, 47.12], [28.72, 47.13]]},
            }
        ],
    }
    bundle = _bundle([], routes={"inspector": inspector, "farmer": farmer})
    ins = bundle["routes/inspector.geojson"]["features"]
    assert len(ins) == 1
    assert ins[0]["geometry"]["type"] == "LineString"
    assert set(ins[0]["properties"]) == {"length_m", "role", "targets_total", "targets_visited"}
    assert ins[0]["properties"]["length_m"] == 7991.683
    assert ins[0]["properties"]["role"] == "inspector"
    assert ins[0]["properties"]["targets_total"] == 12
    assert ins[0]["properties"]["targets_visited"] is None
    _walk(ins[0]["geometry"]["coordinates"])
    far = bundle["routes/farmer.geojson"]["features"][0]
    assert far["properties"]["length_m"] == 100.5
    assert far["properties"]["role"] == "farmer"
    assert far["properties"]["targets_visited"] == 3
    assert far["geometry"]["coordinates"][0] == [28.71, 47.12]
    walks = bundle["summary.json"]["walks"]
    assert walks["inspector"]["length_m"] == 7991.683
    assert walks["inspector"]["stops"] == 12
    assert walks["farmer"]["stops"] == 3


def test_study_area_polygon_sets_area_ha():
    study = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [629000.0, 5220000.0],
                        [629100.0, 5220000.0],
                        [629100.0, 5220100.0],
                        [629000.0, 5220100.0],
                        [629000.0, 5220000.0],
                    ]],
                },
            }
        ],
    }
    summary = _bundle([], study_area=study)["summary.json"]
    assert summary["area_ha"] == 1


def test_write_bundle_is_compact_utf8(tmp_path: Path):
    bundle = _bundle([_row("B", "B-R1", X0, X0 + 210, 5220200.0)])
    write_bundle(bundle, tmp_path)
    assert (tmp_path / "routes").is_dir()
    assert (tmp_path / "layers").is_dir()
    text = (tmp_path / "summary.json").read_text(encoding="utf-8")
    assert "Sireț3 vineyard" in text
    assert "\\u" not in text
    assert ", " not in text
    assert ": " not in text
    assert json.loads(text)["counts"]["blocks"] == 1


def test_cli_web_bundle_one_line(tmp_path: Path, capsys):
    layers = tmp_path / "layers.geojson"
    y = 5220200.0
    layers.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"kind": "row", "vineyard_id": "nope", "row_id": "nope-R9"},
                        "geometry": {"type": "LineString", "coordinates": [[X0, y], [X0 + 250, y]]},
                    },
                    {
                        "type": "Feature",
                        "properties": {"kind": "vineyard", "vineyard_id": "nope"},
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[
                                [X0 + 1, y - 0.3],
                                [X0 + 1.6, y - 0.3],
                                [X0 + 1.6, y + 0.3],
                                [X0 + 1, y + 0.3],
                                [X0 + 1, y - 0.3],
                            ]],
                        },
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    empty = tmp_path / "empty.geojson"
    empty.write_text('{"type":"FeatureCollection","features":[]}', encoding="utf-8")
    out = tmp_path / "data"
    code = main(
        [
            "web-bundle",
            "--layers",
            str(layers),
            "--assemble",
            "--passages",
            str(empty),
            "--forbidden",
            str(empty),
            "--source",
            "marcaj-labels",
            "--flown-on",
            "2026-09-20",
            "--out-dir",
            str(out),
        ]
    )
    assert code == 0
    line = capsys.readouterr().out.strip()
    assert line.startswith("1 blocks, 1 plants, 0 waste, 0 gaps,")
    assert str(out) in line
    summary = json.loads((out / "summary.json").read_text(encoding="utf-8"))
    assert summary["counts"]["blocks"] == 1
    assert summary["source"] == "marcaj-labels"
    assert (out / "layers" / "plants.geojson").is_file()
    assert (out / "blocks.json").is_file()


def test_missing_interrow_cover_is_unset():
    y = 5220200.0
    items = [
        _row("B", "B-R1", X0, X0 + 210, y),
        _interrow("B", X0, y + 3, None),
        _interrow("B", X0 + 30, y + 3, "grass"),
        _interrow("B", X0 + 60, y + 3, "unset"),
        _interrow("B", X0 + 90, y + 3, "bare_soil"),
    ]
    bundle = _bundle(items)
    covers = [f["properties"]["cover"] for f in bundle["layers/interrows.geojson"]["features"]]
    assert covers == ["unset", "unset", "unset", "bare_soil"]
    assert bundle["summary.json"]["cover"]["unset"] == 3
    assert bundle["summary.json"]["cover"]["bare_soil"] == 1


def test_unnumbered_row_does_not_reuse_r001():
    y = 5223000.0
    numbered = _row("A", "A-R001", X0, X0 + 200, y)
    numbered_tail = _row("A", "A-R001", X0 + 200, X0 + 280, y)
    bare = _row("A", "row-a", X0, X0 + 80, y + 8)

    def rows_of(items):
        return {row["id"]: row for row in _bundle(items)["rows.json"]["rows"]}

    for items in ((numbered, numbered_tail, bare), (bare, numbered, numbered_tail)):
        rows = rows_of(items)
        assert set(rows) == {"V01-R001", "V01-R002"}
        assert rows["V01-R001"]["length_m"] == 280.0
        assert rows["V01-R001"]["pieces"] == 2
        assert rows["V01-R002"]["length_m"] == 80.0
        assert rows["V01-R002"]["pieces"] == 1
        assert rows["V01-R001"]["block"] == "V01"
        assert rows["V01-R002"]["block"] == "V01"


def test_write_bundle_drops_stale_routes_layers_and_pmtiles(tmp_path: Path):
    farmer = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"length_m": 10, "role": "farmer"},
                "geometry": {"type": "LineString", "coordinates": [[28.71, 47.12], [28.72, 47.13]]},
            }
        ],
    }
    write_bundle(_bundle([], routes={"inspector": farmer, "farmer": farmer}), tmp_path)
    assert (tmp_path / "routes" / "inspector.geojson").is_file()
    assert (tmp_path / "routes" / "farmer.geojson").is_file()
    (tmp_path / "routes" / "notes.txt").write_text("keep", encoding="utf-8")
    (tmp_path / "layers" / "legacy.geojson").write_text("stale", encoding="utf-8")
    (tmp_path / "layers.pmtiles").write_bytes(b"stale")
    (tmp_path / "keep.txt").write_text("keep", encoding="utf-8")

    write_bundle(_bundle([], routes={"farmer": farmer}), tmp_path)

    assert not (tmp_path / "routes" / "inspector.geojson").exists()
    written = json.loads((tmp_path / "routes" / "farmer.geojson").read_text(encoding="utf-8"))
    assert written["features"][0]["properties"]["role"] == "farmer"
    assert (tmp_path / "routes" / "notes.txt").read_text(encoding="utf-8") == "keep"
    assert not (tmp_path / "layers" / "legacy.geojson").exists()
    assert (tmp_path / "layers" / "plants.geojson").is_file()
    assert not (tmp_path / "layers.pmtiles").exists()
    assert (tmp_path / "keep.txt").read_text(encoding="utf-8") == "keep"
    assert (tmp_path / "summary.json").is_file()
