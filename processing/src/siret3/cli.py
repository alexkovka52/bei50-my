"""siret3 CLI."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import EXPECTED_TILE_COUNT, START_TOLERANCE_M, WORK_CRS
from .cvat11 import CvatImage, build_part_zips, build_team_upload_zip, render_annotations
from .derive import derive_from_canopies, images_from_projected
from .ids import ProjectedPoly
from .project import write_projected
from .marcaj import collect_cvat_images, dump_projected_geojson, projected_from_cvat, write_web_layers
from .measurements import write_csv
from .route import closed_walk, write_route_geojson
from .tiles import inventory, write_index


def _cmd_project(args: argparse.Namespace) -> int:
    fc = write_projected(
        [Path(p) for p in args.inputs],
        Path(args.tiles),
        Path(args.out),
        min_plants=args.min_plants,
        nms_m=args.nms_m,
    )
    print(f"projected {len(fc['features'])} features -> {args.out}")
    return 0


def _cmd_inventory(args: argparse.Namespace) -> int:
    recs = inventory(Path(args.tiles), expect=None if args.allow_partial else EXPECTED_TILE_COUNT)
    write_index(recs, Path(args.out))
    print(f"wrote {len(recs)} rows to {args.out}")
    return 0


def _xy_pairs(seq) -> list[tuple[float, float]]:
    return [(float(x), float(y)) for x, y in seq]


def _rings_from_geometry(geom: dict) -> list[tuple[list[tuple[float, float]], list[list[tuple[float, float]]]]]:
    """Return (exterior, holes) for each polygon, or a single ring with no holes."""
    gtype = geom.get("type")
    coords = geom.get("coordinates") or []
    if gtype == "Polygon" and coords:
        return [(_xy_pairs(coords[0]), [_xy_pairs(r) for r in coords[1:]])]
    if gtype == "MultiPolygon":
        out = []
        for poly in coords:
            if not poly:
                continue
            out.append((_xy_pairs(poly[0]), [_xy_pairs(r) for r in poly[1:]]))
        return out
    if gtype == "LineString":
        return [(_xy_pairs(coords), [])]
    if gtype == "MultiLineString":
        return [(_xy_pairs(line), []) for line in coords]
    if gtype == "Point":
        return [([(float(coords[0]), float(coords[1]))], [])]
    if coords and isinstance(coords[0], (int, float)):
        return [([(float(coords[0]), float(coords[1]))], [])]
    if coords and isinstance(coords[0][0], (int, float)):
        return [(_xy_pairs(coords), [])]
    return []


def _load_projected(path: Path) -> list[ProjectedPoly]:
    return _items_from_collection(json.loads(Path(path).read_text(encoding="utf-8")))


def _items_from_collection(data) -> list[ProjectedPoly]:
    items = []
    for feat in data.get("features", data if isinstance(data, list) else []):
        props = feat.get("properties", feat)
        geom = feat.get("geometry", {})
        kind = props.get("kind") or props.get("type") or props.get("label") or "vineyard"
        parsed = _rings_from_geometry(geom)
        if not parsed and props.get("coords"):
            parsed = [(props["coords"], [])]
        for ring, holes in parsed:
            if not ring:
                continue
            extras: dict = {}
            if holes:
                extras["holes"] = holes
            if props.get("label"):
                extras["label"] = props["label"]
            items.append(
                ProjectedPoly(
                    kind=kind,
                    coords=ring,
                    tile=props.get("tile", ""),
                    vineyard_id=props.get("vineyard_id"),
                    row_id=props.get("row_id"),
                    row_structure=props.get("row_structure"),
                    interrow_cover=props.get("interrow_cover"),
                    extras=extras or None,
                )
            )
    return items


def _dump_geojson(items: list[ProjectedPoly], out: Path) -> None:
    dump_projected_geojson(items, Path(out))


def _cmd_assemble(args: argparse.Namespace) -> int:
    from collections import Counter

    from shapely.geometry import shape
    from shapely.ops import unary_union

    from .assemble import assemble
    from .project import project_inputs

    fc = project_inputs([Path(p) for p in args.inputs], Path(args.tiles))
    items = _items_from_collection(fc)
    passages = None
    if args.passages and Path(args.passages).is_file():
        data = json.loads(Path(args.passages).read_text(encoding="utf-8"))
        passages = unary_union([shape(f["geometry"]).buffer(0) for f in data["features"]])
    items = assemble(items, passages=passages)
    _dump_geojson(items, Path(args.out))
    kinds = dict(Counter(p.kind for p in items))
    n_blocks = len({p.vineyard_id for p in items if p.vineyard_id})
    n_rows = len({p.row_id for p in items if p.row_id})
    print(f"assembled {kinds}, {n_blocks} blocks, {n_rows} rows -> {args.out}")
    return 0


def _cmd_stitch(args: argparse.Namespace) -> int:
    items = _load_projected(Path(args.predictions))
    passages = None
    if args.passages:
        passages = []
        for p in _load_projected(Path(args.passages)):
            holes = (p.extras or {}).get("holes") or []
            passages.append((p.coords, holes) if holes else p.coords)
    items = derive_from_canopies(
        items,
        tiles_dir=Path(args.tiles) if args.tiles else None,
        passages=passages,
        join_m=args.join_m,
        row_join_m=args.row_join_m,
    )
    _dump_geojson(items, Path(args.out))
    print(f"derived {len(items)} features -> {args.out}")
    return 0


def _cmd_cvat(args: argparse.Namespace) -> int:
    from .tiles import list_tile_paths, parse_tile_name

    tiles_dir = Path(args.tiles)
    if args.from_cvat:
        # Marcaj exports name images "1713_siret3_r017_c008.tif"; merge back to tile names.
        images = collect_cvat_images(Path(args.from_cvat))
    elif args.shapes:
        images = images_from_projected(_load_projected(Path(args.shapes)), tiles_dir)
    else:
        images = []
        for path in list_tile_paths(tiles_dir):
            parse_tile_name(path.name)
            width = height = 2048
            try:
                import rasterio

                with rasterio.open(path) as src:
                    width, height = src.width, src.height
            except Exception:
                pass
            images.append(CvatImage(name=path.name, width=width, height=height, shapes=[]))
    if args.xml_only:
        Path(args.out).write_text(render_annotations(images), encoding="utf-8")
        print(f"wrote XML for {len(images)} images")
        return 0
    if args.parts:
        written = build_part_zips(
            images,
            tiles_dir,
            Path(args.parts),
            Path(args.out_dir),
            task_name=args.task_name,
        )
        print(f"wrote {len(written)} part ZIPs in {args.out_dir}")
        return 0
    build_team_upload_zip(images, tiles_dir, Path(args.out), task_name=args.task_name)
    print(f"wrote {args.out} with {len(images)} tiles")
    return 0


def _cmd_measurements(args: argparse.Namespace) -> int:
    items = _load_projected(Path(args.geojson))
    write_csv(items, Path(args.out))
    print(f"wrote {args.out} ({WORK_CRS}, planar, no terrain correction)")
    return 0


def _cmd_inspect(args: argparse.Namespace) -> int:
    from .inspect import inspections_from_canopies

    items = _load_projected(Path(args.geojson))
    found = inspections_from_canopies(items)
    _dump_geojson(found, Path(args.out))
    print(f"wrote {len(found)} inspections -> {args.out}")
    return 0


def _cmd_marcaj_import(args: argparse.Namespace) -> int:
    images = collect_cvat_images(Path(args.source))
    items = projected_from_cvat(images, Path(args.tiles))
    dump_projected_geojson(items, Path(args.out))
    n = len(items)
    kinds = {}
    for p in items:
        kinds[p.kind] = kinds.get(p.kind, 0) + 1
    print(f"imported {n} Marcaj shapes {kinds} -> {args.out} (no GIS re-derive)")
    return 0


def _cmd_split(args: argparse.Namespace) -> int:
    from collections import Counter

    from .splits import spatial_split, write_split

    images = collect_cvat_images(Path(args.export))
    split = spatial_split(images, block=args.block, val_frac=args.val, test_frac=args.test, seed=args.seed)
    write_split(split, Path(args.out), source=str(args.export), block=args.block, seed=args.seed)
    print(f"split {dict(Counter(split.values()))} -> {args.out}")
    return 0


def _cmd_eval(args: argparse.Namespace) -> int:
    from .evaluate import evaluate
    from .splits import load_split

    images = collect_cvat_images(Path(args.gt))
    rep = evaluate(
        images,
        load_split(Path(args.split)),
        args.subset,
        plants_dir=Path(args.plants) if args.plants else None,
        waste_dir=Path(args.waste) if args.waste else None,
        semseg_dir=Path(args.semseg) if args.semseg else None,
        iou=args.iou,
        min_score=args.min_score,
    )
    short = {k: v for k, v in rep.items() if k != "plants_per_tile"}
    print(json.dumps(short, indent=1))
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(rep, indent=1), encoding="utf-8")
    return 0


def _repo_file(*parts: str) -> Path | None:
    for base in (Path(), Path(__file__).resolve().parents[3]):
        path = base.joinpath(*parts)
        if path.is_file():
            return path
    return None


def _read_json(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _passages_work_geom(fc: dict | None):
    """Official passages are EPSG:32635. Reproject if a caller passes WGS84."""
    if not fc or not fc.get("features"):
        return None
    from shapely.geometry import shape
    from shapely.ops import transform, unary_union

    from .crs import transformer

    geoms = [shape(f["geometry"]).buffer(0) for f in fc["features"] if f.get("geometry")]
    if not geoms:
        return None
    geom = unary_union(geoms)
    x, y = geom.centroid.x, geom.centroid.y
    if abs(x) <= 180.0 and abs(y) <= 90.0:
        back = transformer("EPSG:4326", "EPSG:32635")
        geom = transform(lambda a, b, z=None: back.transform(a, b), geom)
    return geom


def _cmd_web_bundle(args: argparse.Namespace) -> int:
    from .assemble import assemble
    from .web_bundle import build_bundle, write_bundle, write_pmtiles

    items = _load_projected(Path(args.layers))
    passages_path = Path(args.passages) if args.passages else _repo_file("data", "challenge", "02_route", "passages.geojson")
    forbidden_path = Path(args.forbidden) if args.forbidden else _repo_file("data", "challenge", "02_route", "forbidden.geojson")
    passages = _read_json(passages_path) if passages_path and Path(passages_path).is_file() else None
    forbidden = _read_json(forbidden_path) if forbidden_path and Path(forbidden_path).is_file() else None
    if args.assemble:
        items = assemble(items, passages=_passages_work_geom(passages))
    routes = {}
    if args.inspector:
        routes["inspector"] = _read_json(Path(args.inspector))
    if args.farmer:
        routes["farmer"] = _read_json(Path(args.farmer))
    baseline = _read_json(Path(args.baseline)) if args.baseline else None
    now_eval = _read_json(Path(args.now)) if args.now else None
    study_path = _repo_file("data", "challenge", "02_route", "study_area.geojson")
    split_path = _repo_file("data", "splits", "siret3_split.json")
    bundle = build_bundle(
        items,
        routes=routes,
        passages=passages,
        forbidden=forbidden,
        baseline=baseline,
        now=now_eval,
        source=args.source,
        flown_on=args.flown_on,
        study_area=_read_json(study_path) if study_path else None,
        split=_read_json(split_path) if split_path else None,
    )
    write_bundle(bundle, Path(args.out_dir))
    pm_status, pm_detail = write_pmtiles(Path(args.out_dir))
    summary = bundle["summary.json"]
    counts = summary["counts"]
    note = ""
    if pm_status == "skipped":
        note = " (tippecanoe not on PATH, skipped layers.pmtiles)"
    elif pm_status == "failed":
        note = " (tippecanoe failed, skipped layers.pmtiles)"
        if pm_detail:
            print(pm_detail, file=sys.stderr)
    print(
        f"{counts['blocks']} blocks, {counts['plants']} plants, {counts['waste']} waste, "
        f"{counts['gaps']} gaps, {summary['row_km']} km of rows -> {args.out_dir}{note}"
    )
    return 0


def _cmd_web_layers(args: argparse.Namespace) -> int:
    written = write_web_layers(
        layers=Path(args.layers) if args.layers else None,
        inspector=Path(args.inspector) if args.inspector else None,
        farmer=Path(args.farmer) if args.farmer else None,
        measurements=Path(args.measurements) if args.measurements else None,
        forbidden=Path(args.forbidden) if args.forbidden else None,
        passages=Path(args.passages) if args.passages else None,
        inspections=Path(args.inspections) if args.inspections else None,
        out_dir=Path(args.out_dir),
    )
    print("wrote " + ", ".join(str(p) for p in written))
    return 0


def _cmd_route(args: argparse.Namespace) -> int:
    from .crs import to_work_xy
    from .ids import centroid
    from .inspect import parse_targets, select_waypoints
    from .route import load_official_start, passable_from_items

    if args.start:
        lon_s, lat_s = [float(x) for x in args.start.split(",")]
        if args.start_crs.upper() in {"EPSG:4326", "4326"}:
            start = to_work_xy(lon_s, lat_s)
        else:
            start = (lon_s, lat_s)
    else:
        start = load_official_start(Path(args.start_file) if args.start_file else None)

    items = _load_projected(Path(args.geojson))
    passages_path = args.passages or (
        str(Path("data/challenge/02_route/passages.geojson"))
        if Path("data/challenge/02_route/passages.geojson").is_file()
        else None
    )
    forbidden_path = args.forbidden or (
        str(Path("data/challenge/02_route/forbidden.geojson"))
        if Path("data/challenge/02_route/forbidden.geojson").is_file()
        else None
    )
    if passages_path:
        items.extend(_load_projected(Path(passages_path)))
    if forbidden_path:
        items.extend(_load_projected(Path(forbidden_path)))
    inter = [p.coords for p in items if p.kind == "interrow_area"]
    passages = [p.coords for p in items if p.kind == "passage"]
    forbidden = [p.coords for p in items if p.kind == "forbidden"]
    wanted = parse_targets(getattr(args, "targets", "inspections,waste"))
    waypoints = select_waypoints(items, wanted)
    if not waypoints:
        waypoints = [
            centroid(p.coords)
            for p in items
            if p.kind in {"waste", "interrow_area", "inspection"}
        ]
    if not waypoints:
        raise SystemExit("No route targets (need inspections, waste, or interrow_area)")
    report: dict = {}
    tour = closed_walk(
        waypoints,
        start,
        interrows=inter,
        passages=passages,
        forbidden=forbidden,
        tolerance_m=args.tolerance,
        require_legal=True,
        passable=passable_from_items(items),
        report=report,
        reach_m=args.reach_m,
    )
    role = "farmer" if wanted == {"waste"} else "inspector"
    write_route_geojson(tour, Path(args.out), start=start, role=role, targets=report)
    dropped = report["targets"] - report["visited"]
    print(f"closed walk {len(tour)} vertices role={role} targets {report} -> {args.out}")
    if report["targets"] and dropped / report["targets"] > args.max_dropped:
        raise SystemExit(f"{dropped}/{report['targets']} targets not on the walk (limit {args.max_dropped:.0%})")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="siret3", description="Sireț3 vineyard processing")
    sub = p.add_subparsers(dest="cmd", required=True)

    inv = sub.add_parser("inventory", help="List and check siret3_rXXX_cYYY.tif tiles")
    inv.add_argument("tiles")
    inv.add_argument("--out", default="data/tile_index.csv")
    inv.add_argument("--allow-partial", action="store_true")
    inv.set_defaults(func=_cmd_inventory)

    pj = sub.add_parser("project", help="Pixel infer GeoJSON → one EPSG:32635 FeatureCollection")
    pj.add_argument("inputs", nargs="+", help="GeoJSON files or directories")
    pj.add_argument("--tiles", default="data/tiles")
    pj.add_argument("--out", default="data/predictions_32635.geojson")
    pj.add_argument("--min-plants", type=int, default=10, help="drop vineyard polygons on tiles below this count")
    pj.add_argument("--nms-m", type=float, default=0.5, help="drop lower-score plants whose centroids are this close")
    pj.set_defaults(func=_cmd_project)

    st = sub.add_parser("stitch", help="Derive rows, inter-rows, and IDs from canopy polygons")
    st.add_argument("predictions")
    st.add_argument("--out", default="data/stitched.geojson")
    st.add_argument("--tiles", default=None, help="tile directory for ExG cover")
    st.add_argument("--passages", default=None, help="GeoJSON that splits blocks (roads)")
    st.add_argument("--join-m", type=float, default=6.0, help="max plant-to-plant gap for one vineyard_id")
    st.add_argument("--row-join-m", type=float, default=2.0, help="max along-row gap to share a row_id across tiles")
    st.set_defaults(func=_cmd_stitch)

    cv = sub.add_parser("cvat-export", help="Build CVAT 1.1 ZIP(s) with shapes")
    cv.add_argument("tiles")
    cv.add_argument("--out", default="team_upload.zip")
    cv.add_argument("--xml-only", action="store_true")
    cv.add_argument("--shapes", default=None, help="GeoJSON features to write into annotations.xml")
    cv.add_argument("--from-cvat", default=None, help="existing CVAT ZIP to copy shapes from")
    cv.add_argument("--parts", default=None, help="directory of official part*.zip (writes 5 ZIPs)")
    cv.add_argument("--out-dir", default="data/cvat_zips")
    cv.add_argument("--task-name", default="siret3")
    cv.set_defaults(func=_cmd_cvat)

    ms = sub.add_parser("measurements", help="Planar EPSG:32635 measurements")
    ms.add_argument("geojson")
    ms.add_argument("--out", default="measurements.csv")
    ms.set_defaults(func=_cmd_measurements)

    ins = sub.add_parser("inspect", help="Gap / missing-planting targets (not Marcaj)")
    ins.add_argument("geojson")
    ins.add_argument("--out", default="inspections.geojson")
    ins.set_defaults(func=_cmd_inspect)

    rt = sub.add_parser("route", help="Closed walk in EPSG:32635, 5 m start snap")
    rt.add_argument("geojson")
    rt.add_argument("--start", default=None, help="lon,lat or x,y; default official start")
    rt.add_argument("--start-file", default=None, help="GeoJSON Point in EPSG:32635")
    rt.add_argument("--start-crs", default="EPSG:4326")
    rt.add_argument("--passages", default=None)
    rt.add_argument("--forbidden", default=None)
    rt.add_argument("--tolerance", type=float, default=START_TOLERANCE_M)
    rt.add_argument("--out", default="route.geojson")
    rt.add_argument(
        "--targets",
        default="inspections,waste",
        help="comma list: inspections,waste (inspector) or waste (farmer)",
    )
    rt.add_argument("--reach-m", type=float, default=30.0, help="serve targets within this distance of legal ground")
    rt.add_argument("--max-dropped", type=float, default=0.05, help="fail if more targets than this share are skipped")
    rt.set_defaults(func=_cmd_route)

    mi = sub.add_parser(
        "marcaj-import",
        help="CVAT/Marcaj export (ZIP/XML/JSON) → EPSG:32635 GeoJSON; keeps human rows/plants",
    )
    mi.add_argument("source", help="ZIP, annotations.xml, json_simple, or a folder of those")
    mi.add_argument("--tiles", default="data/tiles")
    mi.add_argument("--out", default="data/marcaj_32635.geojson")
    mi.set_defaults(func=_cmd_marcaj_import)

    asm = sub.add_parser("assemble", help="Per-tile model output (plants, waste, rows, inter-rows) → IDs, EPSG:32635")
    asm.add_argument("inputs", nargs="+", help="folders of per-tile pixel GeoJSON (infer_yolo / infer_semseg)")
    asm.add_argument("--tiles", default="data/tiles")
    asm.add_argument("--passages", default="data/challenge/02_route/passages.geojson")
    asm.add_argument("--out", default="data/assembled_32635.geojson")
    asm.set_defaults(func=_cmd_assemble)

    sp = sub.add_parser("split", help="Spatial train/val/test split of a Marcaj export by tile blocks")
    sp.add_argument("export", help="Marcaj CVAT ZIP / XML / folder")
    sp.add_argument("--out", default="data/splits/siret3_split.json")
    sp.add_argument("--block", type=int, default=4)
    sp.add_argument("--val", type=float, default=0.15)
    sp.add_argument("--test", type=float, default=0.10)
    sp.add_argument("--seed", type=int, default=0)
    sp.set_defaults(func=_cmd_split)

    ev = sub.add_parser("eval", help="Score per-tile pixel predictions against the Marcaj ground truth")
    ev.add_argument("--gt", default="data/marcaj_export/project37/annotations.xml")
    ev.add_argument("--split", default="data/splits/siret3_split.json")
    ev.add_argument("--subset", default="test", choices=["train", "val", "test"])
    ev.add_argument("--plants", help="folder of per-tile plant GeoJSON (pixel space)")
    ev.add_argument("--waste", help="folder of per-tile waste GeoJSON (pixel space)")
    ev.add_argument("--semseg", help="folder of per-tile row / inter-row GeoJSON from infer_semseg.py")
    ev.add_argument("--iou", type=float, default=0.5)
    ev.add_argument("--min-score", type=float, default=0.0)
    ev.add_argument("--out")
    ev.set_defaults(func=_cmd_eval)

    wb = sub.add_parser("web-bundle", help="Write the Dementra frontend data contract (WGS84 JSON)")
    wb.add_argument("--layers", required=True, help="EPSG:32635 FeatureCollection")
    wb.add_argument("--assemble", action="store_true", help="Recompute block and row ids before export")
    wb.add_argument("--inspector", default=None, help="Inspector route GeoJSON")
    wb.add_argument("--farmer", default=None, help="Farmer route GeoJSON")
    wb.add_argument("--passages", default=None, help="Defaults to data/challenge/02_route/passages.geojson")
    wb.add_argument("--forbidden", default=None, help="Defaults to data/challenge/02_route/forbidden.geojson")
    wb.add_argument("--baseline", default=None, help="siret3 eval --out JSON (before)")
    wb.add_argument("--now", default=None, help="siret3 eval --out JSON (now)")
    wb.add_argument("--source", default="marcaj-labels", choices=["marcaj-labels", "model"])
    wb.add_argument("--flown-on", default="2026-09-20")
    wb.add_argument("--out-dir", default="web/public/data")
    wb.set_defaults(func=_cmd_web_bundle)

    wl = sub.add_parser("web-layers", help="Reproject 32635 layers to WGS84 for MapLibre")
    wl.add_argument("--layers", default=None, help="Marcaj 32635 FeatureCollection")
    wl.add_argument("--inspector", default=None)
    wl.add_argument("--farmer", default=None)
    wl.add_argument("--measurements", default=None)
    wl.add_argument("--forbidden", default=None)
    wl.add_argument("--passages", default=None)
    wl.add_argument("--inspections", default=None)
    wl.add_argument("--out-dir", default="web/public/layers")
    wl.set_defaults(func=_cmd_web_layers)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
