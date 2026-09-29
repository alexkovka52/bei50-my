#!/usr/bin/env python3
"""Chip-based YOLO inference over siret3_rXXX_cYYY.tif. Writes per-tile GeoJSON in pixel space.

Tiles are cut into native 0.025 m/px chips (same as training). A detection is kept only from the
chip whose core (the chip minus half the overlap, extended to the tile border) holds its box
centre, so a plant cut by one chip edge is taken whole from the neighbouring chip. Masks are
full-resolution (`retina_masks`) and each becomes its largest outer contour.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

SKIP_LABELS = {"pole", "trunk", "vine_row"}


def _read_rgb(tile: Path):
    import numpy as np
    import rasterio

    with rasterio.open(tile) as src:
        return np.ascontiguousarray(np.transpose(src.read([1, 2, 3]), (1, 2, 0)))


def chip_grid(width: int, height: int, chip: int, stride: int) -> list[tuple[int, int, int, int]]:
    def starts(size: int) -> list[int]:
        out = list(range(0, max(size - chip, 0) + 1, stride))
        if out[-1] + chip < size:
            out.append(max(size - chip, 0))
        return out

    return [(x0, y0, min(chip, width - x0), min(chip, height - y0)) for y0 in starts(height) for x0 in starts(width)]


def core_of(x0: int, y0: int, w: int, h: int, width: int, height: int, margin: float) -> tuple[float, float, float, float]:
    """Chip core in tile pixels; sides on the tile border are not shrunk."""
    return (
        x0 if x0 == 0 else x0 + margin,
        y0 if y0 == 0 else y0 + margin,
        x0 + w if x0 + w >= width else x0 + w - margin,
        y0 + h if y0 + h >= height else y0 + h - margin,
    )


def in_core(cx: float, cy: float, core: tuple[float, float, float, float]) -> bool:
    x1, y1, x2, y2 = core
    return x1 <= cx < x2 and y1 <= cy < y2


def mask_to_ring(mask, min_area: float = 40.0, tolerance: float = 0.75) -> list[list[float]] | None:
    """Largest outer contour of a boolean mask → closed ring (pixel corners)."""
    import cv2
    import numpy as np
    from shapely.geometry import Polygon

    m = np.ascontiguousarray(mask.astype(np.uint8))
    contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    if cv2.contourArea(c) < min_area or len(c) < 3:
        return None
    poly = Polygon((float(x) + 0.5, float(y) + 0.5) for x, y in c[:, 0, :]).simplify(tolerance)
    if not poly.is_valid:
        poly = poly.buffer(0)
    if poly.geom_type == "MultiPolygon":
        poly = max(poly.geoms, key=lambda g: g.area)
    if poly.is_empty or poly.geom_type != "Polygon" or poly.area < min_area:
        return None
    return [[round(x, 2), round(y, 2)] for x, y in poly.exterior.coords]


def _nms(items: list[dict], iou_thr: float) -> list[dict]:
    """Greedy NMS on polygon IoU (boxes pre-filter), highest score first."""
    from shapely.geometry import Polygon
    from shapely.strtree import STRtree

    items = sorted(items, key=lambda d: -d["score"])
    polys = [Polygon(d["ring"]) for d in items]
    tree = STRtree(polys)
    dead = [False] * len(items)
    keep = []
    for i, p in enumerate(polys):
        if dead[i]:
            continue
        keep.append(items[i])
        for j in tree.query(p):
            j = int(j)
            if j <= i or dead[j]:
                continue
            inter = p.intersection(polys[j]).area
            union = p.area + polys[j].area - inter
            if union > 0 and (inter / union > iou_thr or inter / max(min(p.area, polys[j].area), 1e-6) > 0.8):
                dead[j] = True
    return keep


def infer_tile(model, tile: Path, *, chip: int, stride: int, conf: float, imgsz: int, max_det: int,
               tta: bool = False, iou_thr: float = 0.5) -> list[dict]:
    rgb = _read_rgb(tile)
    height, width = rgb.shape[:2]
    margin = (chip - stride) / 2
    found: list[dict] = []
    windows = chip_grid(width, height, chip, stride)
    crops = [rgb[y0 : y0 + h, x0 : x0 + w] for x0, y0, w, h in windows]
    results = model.predict(source=crops, imgsz=imgsz, conf=conf, max_det=max_det, retina_masks=True,
                            augment=tta, verbose=False)
    for (x0, y0, w, h), result in zip(windows, results):
        if result.boxes is None or len(result.boxes) == 0:
            continue
        core = core_of(x0, y0, w, h, width, height, margin)
        names = result.names
        xyxy = result.boxes.xyxy.cpu().numpy()
        cls = result.boxes.cls.cpu().numpy().astype(int)
        scores = result.boxes.conf.cpu().numpy()
        masks = result.masks.data.cpu().numpy() if result.masks is not None else None
        for i in range(len(xyxy)):
            label = names[int(cls[i])]
            if label in SKIP_LABELS:
                continue
            bx1, by1, bx2, by2 = (float(v) for v in xyxy[i])
            if not in_core(x0 + (bx1 + bx2) / 2, y0 + (by1 + by2) / 2, core):
                continue
            if masks is not None:
                ring = mask_to_ring(masks[i])
                if ring is None:
                    continue
                ring = [[x + x0, y + y0] for x, y in ring]
                kind = "vineyard"
            else:
                a, b, c, d = bx1 + x0, by1 + y0, bx2 + x0, by2 + y0
                ring = [[a, b], [c, b], [c, d], [a, d], [a, b]]
                kind = "waste"
            found.append({"ring": ring, "score": float(scores[i]), "label": label, "kind": kind})
    kept = _nms(found, iou_thr)
    return [
        {
            "type": "Feature",
            "properties": {"kind": d["kind"], "label": d["label"], "tile": tile.name, "score": round(d["score"], 4)},
            "geometry": {"type": "Polygon", "coordinates": [d["ring"]]},
        }
        for d in kept
    ]


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--weights", required=True)
    p.add_argument("--tiles", required=True)
    p.add_argument("--out", default="data/predictions")
    p.add_argument("--chip", type=int, default=1024)
    p.add_argument("--stride", type=int, default=768)
    p.add_argument("--imgsz", type=int, default=0, help="default: same as --chip (native resolution)")
    p.add_argument("--conf", type=float, default=0.25)
    p.add_argument("--iou", type=float, default=0.5, help="cross-chip polygon NMS IoU")
    p.add_argument("--max-det", type=int, default=1500)
    p.add_argument("--tta", action="store_true")
    p.add_argument("--only", nargs="*", help="tile names to run (default all)")
    args = p.parse_args()

    tiles = sorted(Path(args.tiles).glob("siret3_r*_c*.tif"))
    if args.only:
        tiles = [t for t in tiles if t.name in set(args.only)]
    if not tiles:
        raise SystemExit(f"no tiles in {args.tiles}")
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    from ultralytics import YOLO

    model = YOLO(args.weights)
    for tile in tiles:
        features = infer_tile(model, tile, chip=args.chip, stride=args.stride, conf=args.conf,
                              imgsz=args.imgsz or args.chip, max_det=args.max_det, tta=args.tta, iou_thr=args.iou)
        (out_dir / f"{tile.stem}.geojson").write_text(
            json.dumps({"type": "FeatureCollection", "tile": tile.name, "features": features}), encoding="utf-8"
        )
        print(tile.name, len(features), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
