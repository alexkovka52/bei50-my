"""Frontend data contract: web/public/data JSON for the Dementra map.

Inputs are EPSG:32635 features. Outputs are WGS84, version 1.
Block ids V01… are ranks by row length (only blocks with ≥ 200 m of rows).
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon, mapping
from shapely.ops import transform, unary_union

from . import EXPECTED_TILE_COUNT
from .crs import from_work_xy, transformer
from .ids import ProjectedPoly
from .inspect import inspections_from_canopies
from .marcaj import to_wgs84_collection
from .route import OFFICIAL_START

MIN_BLOCK_ROW_M = 200.0
GAP_PRIORITY_M = 20.0
PLANT_SIMPLIFY_M = 0.03
INTERROW_SIMPLIFY_M = 0.15
BLOCK_BUFFER_M = 1.5
BLOCK_SIMPLIFY_M = 0.5
COORD_DIGITS = 7
FARM = "Sireț3 vineyard"
GSD_M = 0.025
AREA_HA_BRIEF = 145

COVER_KEYS = ("bare_soil", "vegetation", "mixed", "unassessable", "unset")
STRUCTURE_KEYS = ("regular", "disrupted", "unassessable", "unset")
_ROW_NUM = re.compile(r"R(\d+)")

_TO_WGS = None


def _to_wgs():
    global _TO_WGS
    if _TO_WGS is None:
        _TO_WGS = transformer("EPSG:32635", "EPSG:4326")
    return _TO_WGS


def _q(value: float, digits: int) -> float:
    return float(f"{float(value):.{digits}f}")


def _xy_ll(x: float, y: float) -> list[float]:
    lon, lat = _to_wgs().transform(x, y)
    return [_q(lon, COORD_DIGITS), _q(lat, COORD_DIGITS)]


def _round_coords(coords):
    if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (int, float)):
        return [_q(coords[0], COORD_DIGITS), _q(coords[1], COORD_DIGITS)]
    return [_round_coords(c) for c in coords]


def _line_length(coords: list[tuple[float, float]]) -> float:
    total = 0.0
    for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
        total += ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    return total


def _clone(item: ProjectedPoly) -> ProjectedPoly:
    return ProjectedPoly(
        kind=item.kind,
        coords=list(item.coords),
        tile=item.tile,
        score=item.score,
        vineyard_id=item.vineyard_id,
        row_id=item.row_id,
        row_structure=item.row_structure,
        interrow_cover=item.interrow_cover,
        extras=dict(item.extras) if item.extras else None,
    )


def _row_number(row_id: str | None) -> int | None:
    if not row_id:
        return None
    match = _ROW_NUM.search(row_id)
    return int(match.group(1)) if match else None


def _geometry(item: ProjectedPoly):
    holes = (item.extras or {}).get("holes") or []
    if item.kind == "row":
        if len(item.coords) < 2:
            return None
        return LineString(item.coords)
    if item.kind == "waste" and len(item.coords) == 2:
        (x0, y0), (x1, y1) = item.coords
        return Polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
    if len(item.coords) >= 3:
        poly = Polygon(item.coords, holes)
        if not poly.is_valid:
            poly = poly.buffer(0)
        return None if poly.is_empty else poly
    if item.coords:
        return Point(item.coords[0])
    return None


def _simplify(geom, tol: float | None):
    if geom is None or geom.is_empty:
        return None
    if tol and geom.geom_type not in {"Point", "MultiPoint"}:
        try:
            geom = geom.simplify(tol, preserve_topology=True)
        except Exception:
            return None
        if geom is None or geom.is_empty:
            return None
    return geom


def _project(geom):
    if geom is None or geom.is_empty:
        return None

    def _fn(x, y, z=None):
        lon, lat = _to_wgs().transform(x, y)
        return _q(lon, COORD_DIGITS), _q(lat, COORD_DIGITS)

    return transform(_fn, geom)


def _geom_json(geom) -> dict | None:
    if geom is None or geom.is_empty:
        return None
    if geom.geom_type == "GeometryCollection":
        polys = [g for g in geom.geoms if g.geom_type in {"Polygon", "MultiPolygon"} and not g.is_empty]
        if not polys:
            return None
        geom = unary_union(polys)
    raw = mapping(geom)
    return {"type": raw["type"], "coordinates": _round_coords(raw["coordinates"])}


def _feature(props: dict, geom) -> dict | None:
    body = _geom_json(geom)
    if body is None:
        return None
    return {"type": "Feature", "properties": props, "geometry": body}


def _fc(features: list[dict]) -> dict:
    return {"type": "FeatureCollection", "version": 1, "features": features}


def _cover_key(value: str | None) -> str:
    if value in COVER_KEYS and value != "unset":
        return value
    return "unset"


def _structure_key(value: str | None) -> str:
    if value in STRUCTURE_KEYS and value != "unset":
        return value
    return "unset"


def _blank_cover() -> dict[str, int]:
    return {k: 0 for k in COVER_KEYS}


def _blank_structure() -> dict[str, int]:
    return {k: 0 for k in STRUCTURE_KEYS}


def _union_area(geoms: list) -> float:
    kept = [g for g in geoms if g is not None and not g.is_empty]
    if not kept:
        return 0.0
    return float(unary_union(kept).area)


def _bounds_of(geoms: list) -> list[float] | None:
    boxes = []
    for geom in geoms:
        projected = _project(geom)
        if projected is None or projected.is_empty:
            continue
        boxes.append(projected.bounds)
    if not boxes:
        return None
    return [
        _q(min(b[0] for b in boxes), COORD_DIGITS),
        _q(min(b[1] for b in boxes), COORD_DIGITS),
        _q(max(b[2] for b in boxes), COORD_DIGITS),
        _q(max(b[3] for b in boxes), COORD_DIGITS),
    ]


def _rank_blocks(items: list[ProjectedPoly]) -> tuple[dict[str, float], dict[str, str]]:
    """Assembled vineyard id → row length, and id → V01… for blocks with ≥ 200 m of rows."""
    length_of: dict[str, float] = defaultdict(float)
    for item in items:
        if item.kind == "row" and item.vineyard_id and len(item.coords) >= 2:
            length_of[item.vineyard_id] += _line_length(item.coords)
    ranked = [
        vid
        for vid, length in sorted(length_of.items(), key=lambda pair: (-pair[1], str(pair[0])))
        if length >= MIN_BLOCK_ROW_M
    ]
    lengths = {vid: length_of[vid] for vid in ranked}
    names = {vid: f"V{i:02d}" for i, vid in enumerate(ranked, start=1)}
    return lengths, names


def _remap(items: list[ProjectedPoly]) -> dict[str, float]:
    """Rewrite vineyard_id / row_id.

    Real blocks become V01… in length rank. Shorter fragments keep a private
    sentinel id so gap matching stays inside the fragment, then the sentinel
    is cleared to null before export. Returns new-block-id → row length (m).
    """
    old_lengths, new_of = _rank_blocks(items)
    length_by_new = {new_of[old]: length for old, length in old_lengths.items()}
    assigned: dict[tuple, str] = {}
    taken: set[str] = set()
    synth: dict[str | None, int] = defaultdict(int)
    # Numbers already printed on a row in this vineyard. Synthetic ids must not reuse them.
    used_nums: dict[str | None, set[int]] = defaultdict(set)
    for item in items:
        if item.kind != "row":
            continue
        parsed = _row_number(item.row_id)
        if parsed is not None:
            used_nums[item.vineyard_id].add(parsed)

    def claim(old: str | None, new: str | None, num: int) -> str:
        key = (old, num)
        if key in assigned:
            return assigned[key]
        base = f"{new}-R{num:03d}" if new else f"X-R{num:03d}"
        rid = base
        n = 2
        while rid in taken:
            rid = f"{base}-{n}"
            n += 1
        assigned[key] = rid
        taken.add(rid)
        return rid

    for item in items:
        old = item.vineyard_id
        new = new_of.get(old) if old else None
        # Sentinel keeps fragment features matched to each other until gaps are built.
        item.vineyard_id = new if new else (f"F:{old}" if old else None)
        num = _row_number(item.row_id)
        if item.kind == "row" and num is None:
            while True:
                synth[old] += 1
                num = synth[old]
                if num not in used_nums[old]:
                    break
            used_nums[old].add(num)
        if num is None:
            continue
        if item.kind == "row" or item.row_id:
            item.row_id = claim(old, new, num)
    return length_by_new


def _clear_fragments(items: list[ProjectedPoly], gaps: list[ProjectedPoly]) -> None:
    for item in list(items) + list(gaps):
        vid = item.vineyard_id
        if isinstance(vid, str) and vid.startswith("F:"):
            item.vineyard_id = None


def _aggregated_structure(pieces: list[ProjectedPoly]) -> str | None:
    values = [p.row_structure for p in pieces]
    if "disrupted" in values:
        return "disrupted"
    if "regular" in values:
        return "regular"
    if "unassessable" in values:
        return "unassessable"
    return None


def _disrupted_pct(pieces: list[ProjectedPoly]) -> int | None:
    regular = sum(1 for p in pieces if p.row_structure == "regular")
    disrupted = sum(1 for p in pieces if p.row_structure == "disrupted")
    assessed = regular + disrupted
    if assessed == 0:
        return None
    return int(round(100.0 * disrupted / assessed))


def _area_ha(study_area) -> int:
    if not study_area:
        return AREA_HA_BRIEF
    from shapely.geometry import shape

    feats = study_area.get("features") if isinstance(study_area, dict) else None
    if feats is None and isinstance(study_area, dict) and study_area.get("type") in {"Polygon", "MultiPolygon"}:
        geom = shape(study_area)
    else:
        parts = []
        for feat in feats or []:
            if feat.get("geometry"):
                parts.append(shape(feat["geometry"]))
        if not parts:
            return AREA_HA_BRIEF
        geom = unary_union(parts)
    if geom.is_empty:
        return AREA_HA_BRIEF
    x, y = geom.centroid.x, geom.centroid.y
    if abs(x) <= 180.0 and abs(y) <= 90.0:
        back = transformer("EPSG:4326", "EPSG:32635")
        geom = transform(lambda a, b, z=None: back.transform(a, b), geom)
    return int(round(float(geom.area) / 10000.0))


def _split_counts(split) -> dict[str, int]:
    if split is None:
        for path in (
            Path("data/splits/siret3_split.json"),
            Path(__file__).resolve().parents[3] / "data" / "splits" / "siret3_split.json",
        ):
            if path.is_file():
                split = json.loads(path.read_text(encoding="utf-8"))
                break
    if not isinstance(split, dict):
        return {"train": 0, "val": 0, "test": 0}
    counts = split.get("counts")
    if isinstance(counts, dict) and {"train", "val", "test"} <= set(counts):
        return {key: int(counts[key]) for key in ("train", "val", "test")}
    tiles = split.get("tiles")
    if isinstance(tiles, dict):
        from collections import Counter

        found = Counter(tiles.values())
        return {"train": int(found.get("train", 0)), "val": int(found.get("val", 0)), "test": int(found.get("test", 0))}
    return {"train": 0, "val": 0, "test": 0}


def _dig(report, *path):
    cur = report
    for key in path:
        if not isinstance(cur, dict) or key not in cur or cur[key] is None:
            return None
        cur = cur[key]
    return cur


def _fmt_f1(value) -> str | None:
    if value is None:
        return None
    try:
        return f"{float(value):.2f}"
    except (TypeError, ValueError):
        return None


def _fmt_pct(value) -> str | None:
    if value is None:
        return None
    try:
        pct = float(value) * 100.0
    except (TypeError, ValueError):
        return None
    text = f"{pct:.1f}".rstrip("0").rstrip(".")
    return f"{text}%"


def _fmt_waste(report) -> str | None:
    block = report.get("waste") if isinstance(report, dict) else None
    if not isinstance(block, dict) or block.get("tp") is None or block.get("gt") is None:
        return None
    return f"{int(block['tp'])} of {int(block['gt'])}"


def _metrics(baseline, now) -> list[dict]:
    baseline = baseline or {}
    now = now or {}
    rows = (
        ("plant_f1", "Plants found correctly (F1)", _fmt_f1(_dig(baseline, "plants", "f1")), _fmt_f1(_dig(now, "plants", "f1"))),
        ("waste_found", "Waste items found", _fmt_waste(baseline), _fmt_waste(now)),
        ("rows_f1", "Rows matched to the drawn rows", _fmt_f1(_dig(baseline, "rows", "f1")), _fmt_f1(_dig(now, "rows", "f1"))),
        ("structure_acc", "Row gaps classified right", _fmt_pct(_dig(baseline, "rows", "structure_acc")), _fmt_pct(_dig(now, "rows", "structure_acc"))),
        ("cover_acc", "Inter-row cover right", _fmt_pct(_dig(baseline, "interrows", "cover_acc")), _fmt_pct(_dig(now, "interrows", "cover_acc"))),
    )
    return [{"key": key, "label": label, "before": before, "now": after} for key, label, before, after in rows]


def _one_linestring(fc: dict | None, role: str) -> dict | None:
    if not fc:
        return None
    wgs = to_wgs84_collection(fc)
    best = None
    best_score = -1.0
    for feat in wgs.get("features") or []:
        props = feat.get("properties") or {}
        geom = feat.get("geometry") or {}
        if geom.get("type") == "LineString":
            lines = [geom.get("coordinates") or []]
        elif geom.get("type") == "MultiLineString":
            lines = list(geom.get("coordinates") or [])
        else:
            continue
        lines = [line for line in lines if len(line) >= 2]
        if not lines:
            continue
        line = max(lines, key=len)
        raw_len = props.get("length_m")
        try:
            score = float(raw_len) if raw_len is not None else float(len(line))
        except (TypeError, ValueError):
            score = float(len(line))
        if score > best_score:
            best_score = score
            best = (props, line)
    if best is None:
        return _fc([])
    props, line = best
    length = props.get("length_m")
    if length is not None:
        try:
            length = float(length)
        except (TypeError, ValueError):
            length = None
    return _fc(
        [
            {
                "type": "Feature",
                "properties": {
                    "length_m": length,
                    "role": props.get("role") or role,
                    "targets_total": props.get("targets_total") if "targets_total" in props else None,
                    "targets_visited": props.get("targets_visited") if "targets_visited" in props else None,
                },
                "geometry": {"type": "LineString", "coordinates": _round_coords(line)},
            }
        ]
    )


def _context_layer(fc: dict | None, kind: str) -> dict:
    if not fc:
        return _fc([])
    wgs = to_wgs84_collection(fc)
    features = []
    for feat in wgs.get("features") or []:
        geom = feat.get("geometry") or {}
        if geom.get("coordinates") is None:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {"kind": kind},
                "geometry": {"type": geom.get("type"), "coordinates": _round_coords(geom["coordinates"])},
            }
        )
    return _fc(features)


def _walk_stats(route_fc: dict | None) -> dict:
    if not route_fc or not route_fc.get("features"):
        return {"length_m": 0, "stops": 0}
    props = route_fc["features"][0].get("properties") or {}
    length = props.get("length_m")
    try:
        length_m = float(length) if length is not None else 0.0
    except (TypeError, ValueError):
        length_m = 0.0
    if props.get("targets_visited") is not None:
        stops = int(props["targets_visited"])
    elif props.get("targets_total") is not None:
        stops = int(props["targets_total"])
    else:
        stops = 0
    return {"length_m": length_m, "stops": stops}


def _block_outline(rows: list[ProjectedPoly]):
    parts = [LineString(row.coords).buffer(BLOCK_BUFFER_M) for row in rows if len(row.coords) >= 2]
    if not parts:
        return None
    foot = unary_union(parts)
    if not foot.is_valid:
        foot = foot.buffer(0)
    foot = _simplify(foot, BLOCK_SIMPLIFY_M)
    if foot is None or foot.is_empty:
        return None
    if foot.geom_type == "GeometryCollection":
        polys = [g for g in foot.geoms if g.geom_type in {"Polygon", "MultiPolygon"}]
        foot = unary_union(polys) if polys else None
    return _project(foot) if foot is not None else None


def build_bundle(
    items,
    *,
    routes,
    passages,
    forbidden,
    baseline,
    now,
    source,
    flown_on,
    study_area=None,
    split=None,
    generated_at=None,
) -> dict[str, object]:
    """Relative path → JSON-serialisable document for web/public/data."""
    items = [_clone(p) for p in items]
    length_by_block = _remap(items)
    gaps = inspections_from_canopies(items)
    _clear_fragments(items, gaps)
    stamp = generated_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    by_kind: dict[str, list[ProjectedPoly]] = defaultdict(list)
    for item in items:
        by_kind[item.kind].append(item)
    rows = by_kind.get("row", [])
    plants = by_kind.get("vineyard", [])
    interrows = by_kind.get("interrow_area", [])
    wastes = by_kind.get("waste", [])

    def block_of(item: ProjectedPoly) -> str | None:
        return item.vineyard_id

    gap_records = _gap_records(gaps)
    waste_records = _waste_records(wastes)
    tasks = _ordered_tasks(gap_records, waste_records)

    block_ids = sorted(length_by_block, key=lambda bid: (-length_by_block[bid], bid))
    blocks = []
    block_features = []
    for bid in block_ids:
        block_rows = [r for r in rows if block_of(r) == bid]
        block_plants = [p for p in plants if block_of(p) == bid]
        block_inter = [p for p in interrows if block_of(p) == bid]
        block_waste = [p for p in wastes if block_of(p) == bid]
        block_gaps = [g for g in gap_records if g["block"] == bid]
        cover = _blank_cover()
        for poly in block_inter:
            cover[_cover_key(poly.interrow_cover)] += 1
        outline = _block_outline(block_rows)
        member_geoms = [g for g in (_geometry(p) for p in block_rows + block_plants + block_inter + block_waste) if g is not None]
        for gap in block_gaps:
            member_geoms.append(Point(gap["_xy"]))
        bbox = _bounds_of(member_geoms)
        if outline is not None and not outline.is_empty:
            centroid_xy = outline.centroid
            centroid = [_q(centroid_xy.x, COORD_DIGITS), _q(centroid_xy.y, COORD_DIGITS)]
        elif bbox:
            centroid = [_q((bbox[0] + bbox[2]) / 2.0, COORD_DIGITS), _q((bbox[1] + bbox[3]) / 2.0, COORD_DIGITS)]
        else:
            centroid = _start_ll()
            bbox = centroid + centroid
        largest = sorted(block_gaps, key=lambda g: (-g["_gap"], g["row_id"] or "", g["id"]))[:3]
        record = {
            "id": bid,
            "rows": len({r.row_id for r in block_rows if r.row_id}),
            "row_km": _q(length_by_block[bid] / 1000.0, 2),
            "plants": len(block_plants),
            "gaps": len(block_gaps),
            "waste": len(block_waste),
            "interrow_ha": _q(_union_area([_geometry(p) for p in block_inter]) / 10000.0, 2),
            "canopy_m2": _q(_union_area([_geometry(p) for p in block_plants]), 1),
            "disrupted_pct": _disrupted_pct(block_rows),
            "cover": cover,
            "bbox": bbox,
            "centroid": centroid,
            "largest_gaps": [
                {"row_id": g["row_id"], "row": g["row"], "gap_m": g["gap_m"], "at": g["at"]} for g in largest
            ],
        }
        blocks.append(record)
        feat = _feature(
            {
                "id": bid,
                "rows": record["rows"],
                "row_km": record["row_km"],
                "gaps": record["gaps"],
                "waste": record["waste"],
            },
            outline,
        )
        if feat:
            block_features.append(feat)

    row_docs = _row_docs(rows)
    start = _start_ll()
    all_geoms = [g for g in (_geometry(p) for p in plants + rows + interrows + wastes) if g is not None]
    bbox = _bounds_of(all_geoms) or (start + start)
    center = [_q((bbox[0] + bbox[2]) / 2.0, COORD_DIGITS), _q((bbox[1] + bbox[3]) / 2.0, COORD_DIGITS)]

    structure = _blank_structure()
    for row in rows:
        structure[_structure_key(row.row_structure)] += 1
    cover = _blank_cover()
    for poly in interrows:
        cover[_cover_key(poly.interrow_cover)] += 1

    inspector = _one_linestring((routes or {}).get("inspector"), "inspector")
    farmer = _one_linestring((routes or {}).get("farmer"), "farmer")
    total_row_m = sum(_line_length(r.coords) for r in rows if len(r.coords) >= 2)

    summary = {
        "version": 1,
        "source": source,
        "generated_at": stamp,
        "flown_on": flown_on,
        "farm": FARM,
        "area_ha": _area_ha(study_area),
        "tiles": EXPECTED_TILE_COUNT,
        "gsd_m": GSD_M,
        "center": center,
        "bbox": bbox,
        "start": start,
        "counts": {
            "blocks": len(block_ids),
            "rows": len({r.row_id for r in rows if r.row_id}),
            "row_pieces": len(rows),
            "plants": len(plants),
            "interrows": len(interrows),
            "waste": len(wastes),
            "gaps": len(gap_records),
        },
        "row_km": _q(total_row_m / 1000.0, 2),
        "canopy_ha": _q(_union_area([_geometry(p) for p in plants]) / 10000.0, 2),
        "interrow_ha": _q(_union_area([_geometry(p) for p in interrows]) / 10000.0, 2),
        "cover": cover,
        "structure": structure,
        "walks": {"inspector": _walk_stats(inspector), "farmer": _walk_stats(farmer)},
    }
    model = {
        "version": 1,
        "updated_at": stamp,
        "dataset": {
            "tiles": EXPECTED_TILE_COUNT,
            "plants": len(plants),
            "rows": len(rows),
            "interrows": len(interrows),
            "waste": len(wastes),
            "split": _split_counts(split),
        },
        "metrics": _metrics(baseline, now),
    }

    bundle: dict[str, object] = {
        "summary.json": summary,
        "blocks.json": {"version": 1, "blocks": blocks},
        "rows.json": {"version": 1, "rows": row_docs},
        "tasks.json": {"version": 1, "tasks": tasks},
        "model.json": model,
        "layers/plants.geojson": _fc(_layer_plants(plants)),
        "layers/rows.geojson": _fc(_layer_rows(rows)),
        "layers/interrows.geojson": _fc(_layer_interrows(interrows)),
        "layers/gaps.geojson": _fc(_layer_gaps(gap_records)),
        "layers/waste.geojson": _fc(_layer_waste(waste_records)),
        "layers/blocks.geojson": _fc(block_features),
        "layers/passages.geojson": _context_layer(passages, "passage"),
        "layers/forbidden.geojson": _context_layer(forbidden, "forbidden"),
    }
    if inspector is not None:
        bundle["routes/inspector.geojson"] = inspector
    if farmer is not None:
        bundle["routes/farmer.geojson"] = farmer
    return bundle


def _gap_records(gaps: list[ProjectedPoly]) -> list[dict]:
    per_row: dict[str, list[ProjectedPoly]] = defaultdict(list)
    for gap in gaps:
        per_row[gap.row_id or "X"].append(gap)
    records = []
    for rid, group in per_row.items():
        for n, gap in enumerate(group, start=1):
            raw = float((gap.extras or {}).get("gap_m") or 0.0)
            xy = gap.coords[0]
            records.append(
                {
                    "id": f"GAP-{rid}-{n:02d}",
                    "kind": "gap",
                    "block": gap.vineyard_id,
                    "row_id": gap.row_id,
                    "row": _row_number(gap.row_id),
                    "gap_m": _q(raw, 1),
                    "_gap": raw,
                    "at": _xy_ll(xy[0], xy[1]),
                    "_xy": (float(xy[0]), float(xy[1])),
                }
            )
    return records


def _waste_records(wastes: list[ProjectedPoly]) -> list[dict]:
    per_block: dict[str, list[tuple[int, ProjectedPoly]]] = defaultdict(list)
    for index, item in enumerate(wastes):
        per_block[item.vineyard_id or "X"].append((index, item))
    records = []
    for token, group in per_block.items():
        for n, (_index, item) in enumerate(group, start=1):
            geom = _geometry(item)
            if geom is None or geom.is_empty:
                continue
            xy = geom.centroid
            records.append(
                {
                    "id": f"WASTE-{token}-{n:03d}",
                    "kind": "waste",
                    "block": item.vineyard_id,
                    "row_id": None,
                    "row": None,
                    "gap_m": None,
                    "_index": _index,
                    "at": _xy_ll(xy.x, xy.y),
                    "_geom": geom,
                    "_token": token,
                }
            )
    return records


def _ordered_tasks(gaps: list[dict], wastes: list[dict]) -> list[dict]:
    """Gaps by size. Waste, ranked by how much waste its block has, sits after gaps ≥ 20 m."""
    gaps_sorted = sorted(gaps, key=lambda g: (-g["_gap"], g["row_id"] or "", g["id"]))
    big = [g for g in gaps_sorted if g["_gap"] >= GAP_PRIORITY_M]
    small = [g for g in gaps_sorted if g["_gap"] < GAP_PRIORITY_M]
    counts: dict[str, int] = defaultdict(int)
    for waste in wastes:
        counts[waste["_token"]] += 1
    waste_sorted = sorted(wastes, key=lambda w: (-counts[w["_token"]], w["_token"], w["_index"]))
    ordered = big + waste_sorted + small
    tasks = []
    for priority, record in enumerate(ordered, start=1):
        tasks.append(
            {
                "id": record["id"],
                "kind": record["kind"],
                "block": record["block"],
                "row_id": record["row_id"],
                "row": record["row"],
                "gap_m": record["gap_m"],
                "at": record["at"],
                "priority": priority,
            }
        )
    return tasks


def _row_docs(rows: list[ProjectedPoly]) -> list[dict]:
    groups: dict[str, list[ProjectedPoly]] = defaultdict(list)
    for row in rows:
        if row.row_id:
            groups[row.row_id].append(row)
    docs = []
    for rid, pieces in groups.items():
        block = pieces[0].vineyard_id
        docs.append(
            {
                "id": rid,
                "block": block,
                "row": _row_number(rid),
                "length_m": _q(sum(_line_length(p.coords) for p in pieces), 1),
                "structure": _aggregated_structure(pieces),
                "pieces": len(pieces),
            }
        )
    docs.sort(key=lambda doc: (doc["block"] is None, doc["block"] or "", doc["row"] or 0, doc["id"]))
    return docs


def _layer_plants(plants: list[ProjectedPoly]) -> list[dict]:
    features = []
    for item in plants:
        feat = _feature({"block": item.vineyard_id}, _project(_simplify(_geometry(item), PLANT_SIMPLIFY_M)))
        if feat:
            features.append(feat)
    return features


def _layer_rows(rows: list[ProjectedPoly]) -> list[dict]:
    features = []
    for item in rows:
        feat = _feature(
            {"id": item.row_id, "block": item.vineyard_id, "structure": item.row_structure},
            _project(_geometry(item)),
        )
        if feat:
            features.append(feat)
    return features


def _layer_interrows(interrows: list[ProjectedPoly]) -> list[dict]:
    features = []
    for item in interrows:
        cover = _cover_key(item.interrow_cover)
        feat = _feature(
            {"block": item.vineyard_id, "cover": cover},
            _project(_simplify(_geometry(item), INTERROW_SIMPLIFY_M)),
        )
        if feat:
            features.append(feat)
    return features


def _layer_gaps(gaps: list[dict]) -> list[dict]:
    features = []
    for gap in gaps:
        feat = _feature(
            {"id": gap["id"], "block": gap["block"], "row_id": gap["row_id"], "gap_m": gap["gap_m"]},
            _project(Point(gap["_xy"])),
        )
        if feat:
            features.append(feat)
    return features


def _layer_waste(wastes: list[dict]) -> list[dict]:
    features = []
    for waste in wastes:
        # Points (centroids) so every map's circle layer draws them; the box stays as a property.
        geom = waste["_geom"]
        box_ll = _project(geom)
        props = {"id": waste["id"], "block": waste["block"]}
        if box_ll is not None and hasattr(box_ll, "bounds"):
            props["bbox"] = [round(v, 7) for v in box_ll.bounds]
        feat = _feature(props, _project(geom.centroid))
        if feat:
            features.append(feat)
    return features


def _start_ll() -> list[float]:
    lon, lat = from_work_xy(*OFFICIAL_START)
    return [_q(lon, COORD_DIGITS), _q(lat, COORD_DIGITS)]


def _purge_stale_outputs(out: Path, produced: set[str]) -> None:
    """Drop route/layer files this bundle no longer writes.

    Only `routes/*.geojson`, `layers/*.geojson`, and `layers.pmtiles` inside
    `out`. Other names in those directories are left alone.
    """
    for folder, pattern in (("routes", "*.geojson"), ("layers", "*.geojson")):
        directory = out / folder
        if not directory.is_dir():
            continue
        for path in directory.glob(pattern):
            if not path.is_file():
                continue
            rel = path.relative_to(out).as_posix()
            if rel not in produced:
                path.unlink()
    pmtiles = out / "layers.pmtiles"
    if pmtiles.is_file() and "layers.pmtiles" not in produced:
        pmtiles.unlink()


def write_bundle(bundle: dict[str, object], out_dir) -> list[Path]:
    """Write compact UTF-8 JSON. Creates routes/ and layers/.

    Removes route GeoJSON, layer GeoJSON, and `layers.pmtiles` left by an
    earlier run when this bundle does not produce them.
    """
    out = Path(out_dir)
    _purge_stale_outputs(out, {Path(rel).as_posix() for rel in bundle})
    (out / "routes").mkdir(parents=True, exist_ok=True)
    (out / "layers").mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for rel, obj in bundle.items():
        path = out / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(obj, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        written.append(path)
    return written


def write_pmtiles(out_dir) -> tuple[str, str]:
    """Build layers.pmtiles when tippecanoe is on PATH.

    Returns (written|skipped|failed, detail). Detail is empty on success.
    """
    exe = shutil.which("tippecanoe")
    if not exe:
        return "skipped", ""
    out = Path(out_dir)
    layers = out / "layers"
    names = ("plants", "rows", "interrows", "gaps", "waste", "blocks", "passages", "forbidden")
    args = [
        exe,
        "-o",
        str(out / "layers.pmtiles"),
        "--force",
        "--minimum-zoom=12",
        "--maximum-zoom=20",
        "--no-feature-limit",
        "--no-tile-size-limit",
    ]
    found = False
    for name in names:
        path = layers / f"{name}.geojson"
        if path.is_file():
            args.append(f"--named-layer={name}:{path}")
            found = True
    if not found:
        return "skipped", ""
    try:
        subprocess.run(args, check=True, capture_output=True)
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or b"").decode("utf-8", "replace").strip()
        return "failed", err[-800:]
    except OSError as exc:
        return "failed", str(exc)
    return "written", ""
