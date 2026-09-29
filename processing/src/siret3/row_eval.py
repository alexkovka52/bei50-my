"""Score derived rows against hand-drawn GT rows, per tile, in metres (pixel × 0.025)."""

from __future__ import annotations

import math
from collections import Counter

from shapely.geometry import LineString

from .cvat11 import CvatImage
from .example_yolo import canonical_tile_name
from .ids import ProjectedPoly

GSD = 0.025


def _m(points) -> list[tuple[float, float]]:
    return [(x * GSD, -y * GSD) for x, y in points]


def _heading(line: LineString) -> float:
    (x0, y0), (x1, y1) = line.coords[0], line.coords[-1]
    return math.atan2(y1 - y0, x1 - x0) % math.pi


def rows_match(a: LineString, b: LineString, *, max_dist: float = 0.8, max_angle_deg: float = 10.0) -> bool:
    d = abs(_heading(a) - _heading(b))
    d = min(d, math.pi - d)
    if math.degrees(d) > max_angle_deg:
        return False
    # symmetric: the shorter line's midpoint and sampled points lie close to the longer one
    short, long_ = (a, b) if a.length <= b.length else (b, a)
    pts = [short.interpolate(t, normalized=True) for t in (0.1, 0.5, 0.9)]
    return max(long_.distance(p) for p in pts) <= max_dist and short.length >= 0.3 * long_.length


def score_rows(images: list[CvatImage], split: dict[str, str], subset: str, derive) -> dict:
    """`derive(plants: list[ProjectedPoly]) -> list[ProjectedPoly]` rows in the same metre frame."""
    tp = n_gt = n_pred = 0
    struct = Counter()
    count_err = 0
    tiles = 0
    for im in images:
        name = canonical_tile_name(im.name)
        if split.get(name) != subset:
            continue
        gt = [s for s in im.shapes if s.label == "row" and len(s.points) >= 2]
        plants = [
            ProjectedPoly(kind="vineyard", coords=_m(s.points), tile=name, vineyard_id=(s.attributes or {}).get("vineyard_id"))
            for s in im.shapes
            if s.label == "vineyard" and len(s.points) >= 3
        ]
        if not gt and not plants:
            continue
        tiles += 1
        pred = derive(plants) if plants else []
        gl = [LineString(_m(s.points)) for s in gt]
        pl = [LineString(r.coords) for r in pred if len(r.coords) >= 2]
        used = set()
        for i, g in enumerate(gl):
            for j, p in enumerate(pl):
                if j in used or not rows_match(g, p):
                    continue
                used.add(j)
                tp += 1
                want = (gt[i].attributes or {}).get("row_structure")
                if want in ("regular", "disrupted"):
                    struct[(want, pred[j].row_structure)] += 1
                break
        n_gt += len(gl)
        n_pred += len(pl)
        count_err += abs(len(gl) - len(pl))
    prec = tp / n_pred if n_pred else 0.0
    rec = tp / n_gt if n_gt else 0.0
    ok = sum(v for (a, b), v in struct.items() if a == b)
    return {
        "tiles": tiles, "gt": n_gt, "pred": n_pred, "tp": tp,
        "precision": round(prec, 4), "recall": round(rec, 4),
        "f1": round(2 * prec * rec / (prec + rec), 4) if prec + rec else 0.0,
        "mean_abs_count_err_per_tile": round(count_err / max(tiles, 1), 2),
        "structure_acc": round(ok / max(sum(struct.values()), 1), 4),
        "structure_confusion": {f"{a}->{b}": v for (a, b), v in sorted(struct.items())},
    }
