"""Marcaj ground truth (CVAT 1.1, pixel space) → training datasets.

- plants: YOLO-seg, one class `vineyard`, native 0.025 m/px chips.
- waste: YOLO-detect, one class `waste`, chips with waste oversampled in train.
- semseg: full-tile masks for inter-row area + cover (0 bg, 1 canopy, 2..4 cover, 255 ignore).

Every builder follows one spatial split (`siret3 split`), wipes its output folder first,
and clips shapes to the chip instead of dropping or clamping them.
"""

from __future__ import annotations

import random
import shutil
from pathlib import Path

import numpy as np

from .cvat11 import CvatImage, CvatShape
from .example_yolo import canonical_tile_name, chip_windows

SUBSETS = ("train", "val", "test")
IGNORE = 255
CANOPY = 1
COVER_CLASSES = {"bare_soil": 2, "vegetation": 3, "mixed": 4}
SEMSEG_NAMES = ["background", "canopy", "bare_soil", "vegetation", "mixed"]


def _valid_polygonal(points):
    from shapely.geometry import Polygon
    from shapely.validation import make_valid

    if len(points) < 3:
        return None
    geom = Polygon(points)
    if not geom.is_valid:
        geom = make_valid(geom)
    parts = [g for g in getattr(geom, "geoms", [geom]) if g.geom_type == "Polygon" and not g.is_empty]
    if not parts:
        return None
    from shapely.geometry import MultiPolygon

    return parts[0] if len(parts) == 1 else MultiPolygon(parts)


def clip_polygon_to_chip(
    points: list[tuple[float, float]],
    x0: int,
    y0: int,
    w: int,
    h: int,
    *,
    min_frac: float = 0.3,
    min_area: float = 150.0,
) -> list[list[tuple[float, float]]]:
    """Clip a pixel polygon to a chip; return exterior rings in chip coordinates.

    The part inside must hold at least `min_frac` of the polygon and `min_area` px².
    """
    from shapely.geometry import box

    geom = _valid_polygonal(points)
    if geom is None or geom.area <= 0:
        return []
    inside = geom.intersection(box(x0, y0, x0 + w, y0 + h))
    if inside.is_empty or inside.area < min_area or inside.area < min_frac * geom.area:
        return []
    rings = []
    for part in getattr(inside, "geoms", [inside]):
        if part.geom_type != "Polygon" or part.area < 1.0:
            continue
        ring = [(x - x0, y - y0) for x, y in list(part.exterior.coords)[:-1]]
        if len(ring) >= 3:
            rings.append(ring)
    return rings


def clip_box_to_chip(
    xyxy: tuple[float, float, float, float],
    x0: int,
    y0: int,
    w: int,
    h: int,
    *,
    min_frac: float = 0.4,
) -> tuple[float, float, float, float] | None:
    x1, y1, x2, y2 = xyxy
    area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    cx1, cy1 = max(x1, x0), max(y1, y0)
    cx2, cy2 = min(x2, x0 + w), min(y2, y0 + h)
    inside = max(0.0, cx2 - cx1) * max(0.0, cy2 - cy1)
    if area <= 0 or inside < min_frac * area:
        return None
    return (cx1, cy1, cx2, cy2)


def semseg_mask(shapes: list[CvatShape], width: int, height: int) -> np.ndarray:
    """Rasterize inter-rows (by cover, unset → ignore) with plant canopies drawn on top."""
    from rasterio.features import rasterize

    layers = []
    for s in shapes:
        if s.label != "interrow_area":
            continue
        geom = _valid_polygonal(s.points)
        if geom is not None:
            cover = (s.attributes or {}).get("interrow_cover")
            layers.append((geom, COVER_CLASSES.get(cover or "", IGNORE)))
    for s in shapes:
        if s.label != "vineyard":
            continue
        geom = _valid_polygonal(s.points)
        if geom is not None:
            layers.append((geom, CANOPY))
    if not layers:
        return np.zeros((height, width), dtype=np.uint8)
    return rasterize(layers, out_shape=(height, width), fill=0, dtype="uint8")


def row_mask(shapes: list[CvatShape], width: int, height: int, *, half_width_px: float = 8.0) -> np.ndarray:
    """Row centre lines buffered to ~0.4 m (1 = row, 0 = background)."""
    from rasterio.features import rasterize
    from shapely.geometry import LineString

    lines = [
        (LineString(s.points).buffer(half_width_px, cap_style="flat"), 1)
        for s in shapes
        if s.label == "row" and len(s.points) >= 2
    ]
    if not lines:
        return np.zeros((height, width), dtype=np.uint8)
    return rasterize(lines, out_shape=(height, width), fill=0, dtype="uint8")


def _read_rgb(tile: Path) -> np.ndarray:
    import rasterio

    with rasterio.open(tile) as src:
        bands = src.read([1, 2, 3])
    return np.ascontiguousarray(np.transpose(bands, (1, 2, 0)))


def _save_png(path: Path, arr: np.ndarray) -> None:
    from PIL import Image

    Image.fromarray(arr).save(path, compress_level=1)


def _fresh(out: Path, kinds: tuple[str, ...] = ("images", "labels")) -> dict[str, tuple[Path, Path]]:
    if out.exists():
        shutil.rmtree(out)
    dirs = {}
    for sub in SUBSETS:
        paths = tuple(out / k / sub for k in kinds)
        for p in paths:
            p.mkdir(parents=True, exist_ok=True)
        dirs[sub] = paths
    return dirs


def _yaml(out: Path, name: str, classes: list[str]) -> None:
    lines = [f"path: {out.resolve()}", "train: images/train", "val: images/val", "test: images/test", "names:"]
    lines += [f"  {i}: {c}" for i, c in enumerate(classes)]
    (out / name).write_text("\n".join(lines) + "\n", encoding="utf-8")


def _norm(v: float, size: int) -> str:
    return f"{min(1.0, max(0.0, v / size)):.6f}"


def _subset(split: dict[str, str], name: str) -> str | None:
    return split.get(canonical_tile_name(name))


def _has_structure_without_plants(im: CvatImage) -> bool:
    """Rows drawn but no plants: the tile is unfinished, not empty.

    Fields drawn only as `interrow_area` (tilled land, grass between orchard trees) have no visible
    vines, so they stay in as negatives.
    """
    labels = {s.label for s in im.shapes}
    return "vineyard" not in labels and "row" in labels


def split_strip(
    points: list[tuple[float, float]],
    *,
    pitch_px: float = 50.0,
    max_len_px: float = 150.0,
) -> list[list[tuple[float, float]]]:
    """Cut a whole-row `vineyard` polygon into plant-sized pieces along its long axis.

    Annotation rule 2.2: continuous canopy is split at the in-row planting distance (1.0–1.5 m,
    ~50 px at 0.025 m/px). Polygons shorter than `max_len_px` are returned unchanged.
    """
    import math

    from shapely.affinity import rotate
    from shapely.geometry import box

    import warnings

    geom = _valid_polygonal(points)
    if geom is None or geom.area <= 0:
        return []
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        rect = geom.minimum_rotated_rectangle
    if rect.geom_type != "Polygon":
        return [list(points)]
    xs, ys = rect.exterior.coords.xy
    edges = [(xs[i + 1] - xs[i], ys[i + 1] - ys[i]) for i in range(2)]
    dx, dy = max(edges, key=lambda e: math.hypot(*e))
    if math.hypot(dx, dy) <= max_len_px:
        return [list(points)]
    angle = math.degrees(math.atan2(dy, dx))
    origin = geom.centroid
    flat = rotate(geom, -angle, origin=origin)
    x0, y0, x1, y1 = flat.bounds
    n = max(1, round((x1 - x0) / pitch_px))
    step = (x1 - x0) / n
    pieces = []
    for i in range(n):
        cut = flat.intersection(box(x0 + i * step, y0 - 1, x0 + (i + 1) * step, y1 + 1))
        for part in getattr(cut, "geoms", [cut]):
            if part.geom_type == "Polygon" and part.area >= 1.0:
                back = rotate(part, angle, origin=origin)
                pieces.append([(float(x), float(y)) for x, y in list(back.exterior.coords)[:-1]])
    return pieces


def build_plant_seg(
    images: list[CvatImage],
    tiles_dir: Path,
    split: dict[str, str],
    out: Path,
    *,
    chip: int = 1024,
    stride: int = 512,
    empty_keep: float = 0.25,
    seed: int = 0,
    min_frac: float = 0.3,
    min_area: float = 150.0,
    split_strips: bool = True,
) -> dict[str, dict[str, int]]:
    """YOLO-seg chips of per-plant canopies. Tiles with rows but no plant polygons are skipped."""
    out = Path(out)
    dirs = _fresh(out)
    rng = random.Random(seed)
    stats = {sub: {"chips": 0, "instances": 0, "empty": 0, "skipped_tiles": 0} for sub in SUBSETS}
    for im in images:
        sub = _subset(split, im.name)
        if sub is None:
            continue
        if _has_structure_without_plants(im):
            stats[sub]["skipped_tiles"] += 1
            continue
        name = canonical_tile_name(im.name)
        rgb = _read_rgb(Path(tiles_dir) / name)
        height, width = rgb.shape[:2]
        plants = [
            piece
            for s in im.shapes
            if s.label == "vineyard"
            for piece in (split_strip(s.points) if split_strips else [s.points])
        ]
        img_dir, lab_dir = dirs[sub]
        for x0, y0, w, h in chip_windows(width, height, chip=chip, stride=stride):
            lines = []
            for pts in plants:
                for ring in clip_polygon_to_chip(pts, x0, y0, w, h, min_frac=min_frac, min_area=min_area):
                    lines.append("0 " + " ".join(f"{_norm(x, w)} {_norm(y, h)}" for x, y in ring))
            if not lines:
                if rng.random() >= empty_keep:
                    continue
                stats[sub]["empty"] += 1
            stem = f"{Path(name).stem}_{x0}_{y0}"
            _save_png(img_dir / f"{stem}.png", rgb[y0 : y0 + h, x0 : x0 + w])
            (lab_dir / f"{stem}.txt").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
            stats[sub]["chips"] += 1
            stats[sub]["instances"] += len(lines)
    _yaml(out, "plants.yaml", ["vineyard"])
    return stats


def build_waste_det(
    images: list[CvatImage],
    tiles_dir: Path,
    split: dict[str, str],
    out: Path,
    *,
    chip: int = 1024,
    stride: int = 512,
    oversample: int = 8,
    neg_per_tile: int = 2,
    seed: int = 0,
    min_frac: float = 0.4,
) -> dict[str, dict[str, int]]:
    """YOLO-detect chips. Train chips with waste are repeated `oversample` times (hard links)."""
    import os

    out = Path(out)
    dirs = _fresh(out)
    rng = random.Random(seed)
    stats = {sub: {"chips": 0, "boxes": 0, "negatives": 0} for sub in SUBSETS}
    for im in images:
        sub = _subset(split, im.name)
        if sub is None:
            continue
        name = canonical_tile_name(im.name)
        boxes = [
            (float(s.xtl), float(s.ytl), float(s.xbr), float(s.ybr))
            for s in im.shapes
            if s.label == "waste" and s.tag == "box"
        ]
        windows = chip_windows(im.width or 2048, im.height or 2048, chip=chip, stride=stride)
        positives, negatives = [], []
        for win in windows:
            x0, y0, w, h = win
            clipped = [c for b in boxes if (c := clip_box_to_chip(b, x0, y0, w, h, min_frac=min_frac))]
            touches = any(clip_box_to_chip(b, x0, y0, w, h, min_frac=1e-9) for b in boxes)
            if clipped:
                positives.append((win, clipped))
            elif not touches:
                negatives.append((win, []))
        rng.shuffle(negatives)
        chosen = positives + negatives[:neg_per_tile]
        if not chosen:
            continue
        rgb = _read_rgb(Path(tiles_dir) / name)
        img_dir, lab_dir = dirs[sub]
        for (x0, y0, w, h), clipped in chosen:
            stem = f"{Path(name).stem}_{x0}_{y0}"
            lines = [
                f"0 {_norm((a + c) / 2, w)} {_norm((b + d) / 2, h)} {_norm(c - a, w)} {_norm(d - b, h)}"
                for a, b, c, d in ((a - x0, b - y0, c - x0, d - y0) for a, b, c, d in clipped)
            ]
            text = "\n".join(lines) + ("\n" if lines else "")
            copies = oversample if (clipped and sub == "train") else 1
            img = img_dir / f"{stem}.png"
            _save_png(img, rgb[y0 : y0 + h, x0 : x0 + w])
            (lab_dir / f"{stem}.txt").write_text(text, encoding="utf-8")
            for k in range(1, copies):
                os.link(img, img_dir / f"{stem}_dup{k}.png")
                (lab_dir / f"{stem}_dup{k}.txt").write_text(text, encoding="utf-8")
            stats[sub]["chips"] += copies
            stats[sub]["boxes"] += len(lines) * copies
            stats[sub]["negatives"] += 0 if clipped else 1
    _yaml(out, "waste.yaml", ["waste"])
    return stats


def build_semseg(
    images: list[CvatImage],
    tiles_dir: Path,
    split: dict[str, str],
    out: Path,
) -> dict[str, int]:
    """Full-tile cover masks (`masks/`), row-line masks (`rowmasks/`) + per-subset lists. Training crops chips on the fly from the GeoTIFFs."""
    import json

    out = Path(out)
    if out.exists():
        shutil.rmtree(out)
    (out / "masks").mkdir(parents=True)
    (out / "rowmasks").mkdir(parents=True)
    lists: dict[str, list[str]] = {sub: [] for sub in SUBSETS}
    for im in images:
        sub = _subset(split, im.name)
        if sub is None:
            continue
        name = canonical_tile_name(im.name)
        mask = semseg_mask(im.shapes, im.width or 2048, im.height or 2048)
        _save_png(out / "masks" / f"{Path(name).stem}.png", mask)
        _save_png(out / "rowmasks" / f"{Path(name).stem}.png", row_mask(im.shapes, im.width or 2048, im.height or 2048))
        lists[sub].append(name)
    meta = {
        "tiles_dir": str(Path(tiles_dir).resolve()),
        "classes": SEMSEG_NAMES,
        "ignore_index": IGNORE,
        **{sub: sorted(v) for sub, v in lists.items()},
    }
    (out / "semseg.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    return {sub: len(v) for sub, v in lists.items()}
