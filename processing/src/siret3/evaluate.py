"""Score per-tile pixel predictions against the Marcaj ground truth on one split subset.

Plants: greedy one-to-one matching by mask IoU ≥ `iou` → precision / recall / F1 and count error.
GT whole-row strips are split at planting pitch first (same as training), so a correct
per-plant model is not punished for the annotators' strips.
Waste: box matching by IoU ≥ `iou` (recall is what the farmer route needs).
"""

from __future__ import annotations

import json
from pathlib import Path

from .cvat11 import CvatImage
from .example_yolo import canonical_tile_name
from .yolo_datasets import _valid_polygonal, plant_row_coverage, split_strip


def _pred_polys(path: Path, kind: str, min_score: float):
    from shapely.geometry import Polygon

    if not path.is_file():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for f in data.get("features", []):
        props = f.get("properties") or {}
        if (props.get("kind") or "vineyard") != kind or float(props.get("score", 1.0)) < min_score:
            continue
        ring = (f.get("geometry") or {}).get("coordinates", [[]])[0]
        if len(ring) < 3:
            continue
        p = Polygon(ring)
        if not p.is_valid:
            p = p.buffer(0)
        if not p.is_empty and p.area > 0:
            out.append((p, float(props.get("score", 1.0))))
    return out


def match(gt: list, pred: list[tuple], iou: float) -> int:
    """Greedy highest-score-first matching; returns true positives."""
    from shapely.strtree import STRtree

    if not gt or not pred:
        return 0
    tree = STRtree(gt)
    used = set()
    tp = 0
    for p, _s in sorted(pred, key=lambda t: -t[1]):
        best, best_j = 0.0, None
        for j in tree.query(p):
            j = int(j)
            if j in used:
                continue
            inter = p.intersection(gt[j]).area
            if inter <= 0:
                continue
            v = inter / (p.area + gt[j].area - inter)
            if v > best:
                best, best_j = v, j
        if best_j is not None and best >= iou:
            used.add(best_j)
            tp += 1
    return tp


def _prf(tp: int, n_gt: int, n_pred: int) -> dict:
    p = tp / n_pred if n_pred else 0.0
    r = tp / n_gt if n_gt else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return {"tp": tp, "gt": n_gt, "pred": n_pred, "precision": round(p, 4), "recall": round(r, 4), "f1": round(f, 4)}


def evaluate(
    images: list[CvatImage],
    split: dict[str, str],
    subset: str,
    *,
    plants_dir: Path | None = None,
    waste_dir: Path | None = None,
    semseg_dir: Path | None = None,
    iou: float = 0.5,
    waste_iou: float = 0.3,
    min_score: float = 0.0,
) -> dict:
    from shapely.geometry import box

    report: dict = {"subset": subset, "iou": iou}
    tiles = [im for im in images if split.get(canonical_tile_name(im.name)) == subset]
    report["tiles"] = len(tiles)
    if plants_dir is not None:
        tp = n_gt = n_pred = 0
        abs_err = 0
        per_tile = {}
        ctp = cgt = cpred = 0
        for im in tiles:
            name = canonical_tile_name(im.name)
            gt = []
            for s in im.shapes:
                if s.label != "vineyard":
                    continue
                for piece in split_strip(s.points):
                    g = _valid_polygonal(piece)
                    if g is not None:
                        gt.extend(getattr(g, "geoms", [g]))
            pred = _pred_polys(Path(plants_dir) / f"{Path(name).stem}.geojson", "vineyard", min_score)
            t = match(gt, pred, iou)
            tp, n_gt, n_pred = tp + t, n_gt + len(gt), n_pred + len(pred)
            abs_err += abs(len(pred) - len(gt))
            cov = plant_row_coverage(im)
            complete = cov is None or cov >= 0.45
            if complete:
                ctp, cgt, cpred = ctp + t, cgt + len(gt), cpred + len(pred)
            per_tile[name] = {"gt": len(gt), "pred": len(pred), "tp": t, "complete_labels": complete}
        report["plants"] = {**_prf(tp, n_gt, n_pred), "mean_abs_count_err_per_tile": round(abs_err / max(len(tiles), 1), 2)}
        report["plants_complete_tiles"] = _prf(ctp, cgt, cpred)
        report["plants_per_tile"] = per_tile
    if waste_dir is not None:
        tp = n_gt = n_pred = 0
        for im in tiles:
            name = canonical_tile_name(im.name)
            gt = [box(s.xtl, s.ytl, s.xbr, s.ybr) for s in im.shapes if s.label == "waste" and s.tag == "box"]
            pred = _pred_polys(Path(waste_dir) / f"{Path(name).stem}.geojson", "waste", min_score)
            t = match(gt, pred, waste_iou)
            tp, n_gt, n_pred = tp + t, n_gt + len(gt), n_pred + len(pred)
        report["waste"] = {**_prf(tp, n_gt, n_pred), "iou": waste_iou}
    if semseg_dir is not None:
        report.update(_eval_rows_interrows(tiles, Path(semseg_dir)))
    return report


def _eval_rows_interrows(tiles: list[CvatImage], semseg_dir: Path) -> dict:
    from collections import Counter

    from shapely.geometry import LineString, Polygon
    from shapely.ops import unary_union

    from .row_eval import _m, rows_match

    tp = n_gt = n_pred = 0
    struct = Counter()
    inter_i = inter_u = 0.0
    cover = Counter()
    for im in tiles:
        name = canonical_tile_name(im.name)
        path = semseg_dir / f"{Path(name).stem}.geojson"
        feats = json.loads(path.read_text(encoding="utf-8"))["features"] if path.is_file() else []
        pred_rows = [f for f in feats if f["properties"]["kind"] == "row"]
        pred_ir = [f for f in feats if f["properties"]["kind"] == "interrow_area"]
        gt_rows = [s for s in im.shapes if s.label == "row" and len(s.points) >= 2]
        gl = [LineString(_m(s.points)) for s in gt_rows]
        pl = [LineString(_m(f["geometry"]["coordinates"])) for f in pred_rows]
        used = set()
        for i, g in enumerate(gl):
            for j, q in enumerate(pl):
                if j in used or not rows_match(g, q):
                    continue
                used.add(j)
                tp += 1
                want = (gt_rows[i].attributes or {}).get("row_structure")
                if want in ("regular", "disrupted"):
                    struct[(want, pred_rows[j]["properties"].get("row_structure"))] += 1
                break
        n_gt, n_pred = n_gt + len(gl), n_pred + len(pl)
        gt_ir = [(s, _valid_polygonal(s.points)) for s in im.shapes if s.label == "interrow_area"]
        gt_ir = [(s, g) for s, g in gt_ir if g is not None]
        pr_ir = []
        for f in pred_ir:
            g = Polygon(f["geometry"]["coordinates"][0])
            pr_ir.append((f["properties"].get("interrow_cover"), g if g.is_valid else g.buffer(0)))
        gu = unary_union([g for _s, g in gt_ir]) if gt_ir else Polygon()
        pu = unary_union([g for _c, g in pr_ir]) if pr_ir else Polygon()
        inter_i += gu.intersection(pu).area
        inter_u += gu.union(pu).area
        for s, g in gt_ir:
            want = (s.attributes or {}).get("interrow_cover")
            if want not in ("bare_soil", "vegetation", "mixed"):
                continue
            best = max(pr_ir, key=lambda t: t[1].intersection(g).area, default=None)
            got = best[0] if best is not None and best[1].intersection(g).area > 0.3 * g.area else "missed"
            cover[(want, got)] += 1
    ok = sum(v for (a, b), v in struct.items() if a == b)
    cov_ok = sum(v for (a, b), v in cover.items() if a == b)
    classes = ("bare_soil", "vegetation", "mixed")
    f1s = []
    for c in classes:
        tp_c = cover[(c, c)]
        fp_c = sum(v for (a, b), v in cover.items() if b == c and a != c)
        fn_c = sum(v for (a, b), v in cover.items() if a == c and b != c)
        f1s.append(2 * tp_c / max(2 * tp_c + fp_c + fn_c, 1))
    return {
        "rows": {**_prf(tp, n_gt, n_pred), "structure_acc": round(ok / max(sum(struct.values()), 1), 4),
                 "structure_confusion": {f"{a}->{b}": v for (a, b), v in sorted(struct.items())}},
        "interrows": {"area_iou": round(inter_i / max(inter_u, 1e-9), 4),
                      "cover_acc": round(cov_ok / max(sum(cover.values()), 1), 4),
                      "cover_macro_f1": round(sum(f1s) / 3, 4),
                      "cover_confusion": {f"{a}->{b}": v for (a, b), v in sorted(cover.items())}},
    }
