"""Row centre lines from a row-line segmentation map (pixel space, 0.025 m/px).

1. Threshold, connected components; each component → PCA line (split if it holds two rows).
2. Merge collinear pieces of one row across gaps (rows run through gaps, annotation rule 3).
3. `row_structure`: longest run without canopy between the first and last canopy ≥ 5 m → disrupted.
"""

from __future__ import annotations

import math

import numpy as np

GSD = 0.025
GAP_M = 5.0


def _pca(pts: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    mean = pts.mean(0)
    cov = np.cov((pts - mean).T) if len(pts) > 2 else np.eye(2)
    vals, vecs = np.linalg.eigh(cov)
    return mean, vecs[:, int(np.argmax(vals))]


def _segment(pts: np.ndarray) -> dict:
    mean, u = _pca(pts)
    t = (pts - mean) @ u
    return {"pts": pts, "mean": mean, "u": u, "t0": float(t.min()), "t1": float(t.max())}


def _split_by_perp(pts: np.ndarray, gap_px: float) -> list[np.ndarray]:
    mean, u = _pca(pts)
    n = np.array([-u[1], u[0]])
    perp = (pts - mean) @ n
    order = np.argsort(perp)
    cuts = np.nonzero(np.diff(perp[order]) > gap_px)[0]
    return [pts[idx] for idx in np.split(order, cuts + 1)]


def rows_from_prob(
    prob: np.ndarray,
    *,
    thr: float = 0.5,
    min_area_px: int = 40,
    max_angle_deg: float = 5.0,
    max_offset_px: float = 10.0,
    max_gap_px: float = 600.0,
    min_len_px: float = 20.0,
) -> list[list[tuple[float, float]]]:
    """Return row polylines `[(x0, y0), (x1, y1)]` in pixel coordinates."""
    import cv2

    binary = (prob >= thr).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    segs: list[dict] = []
    for k in range(1, n):
        if stats[k, cv2.CC_STAT_AREA] < min_area_px:
            continue
        ys, xs = np.nonzero(labels == k)
        pts = np.stack([xs + 0.5, ys + 0.5], 1).astype(np.float64)
        if len(pts) > 4000:
            pts = pts[:: len(pts) // 4000 + 1]
        for part in _split_by_perp(pts, gap_px=20.0):
            if len(part) >= 20:
                segs.append(_segment(part))

    # union-find over collinear, close pieces
    parent = list(range(len(segs)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    cos_max = math.cos(math.radians(max_angle_deg))
    for i, a in enumerate(segs):
        for j in range(i + 1, len(segs)):
            b = segs[j]
            if abs(float(a["u"] @ b["u"])) < cos_max:
                continue
            na = np.array([-a["u"][1], a["u"][0]])
            if abs(float((b["mean"] - a["mean"]) @ na)) > max_offset_px:
                continue
            ta = (b["mean"] - a["mean"]) @ a["u"]
            b0, b1 = ta - (b["t1"] - b["t0"]) / 2, ta + (b["t1"] - b["t0"]) / 2
            gap = max(b0 - a["t1"], a["t0"] - b1, 0.0)
            if gap <= max_gap_px:
                parent[find(i)] = find(j)

    groups: dict[int, list[np.ndarray]] = {}
    for i, s in enumerate(segs):
        groups.setdefault(find(i), []).append(s["pts"])
    rows = []
    for parts in groups.values():
        seg = _segment(np.concatenate(parts))
        if seg["t1"] - seg["t0"] < min_len_px:
            continue
        p0 = seg["mean"] + seg["u"] * seg["t0"]
        p1 = seg["mean"] + seg["u"] * seg["t1"]
        rows.append([(float(p0[0]), float(p0[1])), (float(p1[0]), float(p1[1]))])
    return rows


def row_structure_from_canopy(
    row: list[tuple[float, float]],
    canopy: np.ndarray,
    *,
    thr: float = 0.5,
    half_width_px: int = 12,
    step_px: float = 4.0,
    gap_m: float = GAP_M,
) -> str:
    """`disrupted` when the row has a canopy-free run ≥ `gap_m` between its first and last canopy."""
    (x0, y0), (x1, y1) = row[0], row[-1]
    length = math.hypot(x1 - x0, y1 - y0)
    if length < 1:
        return "regular"
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    nx, ny = -uy, ux
    h, w = canopy.shape
    offs = np.arange(-half_width_px, half_width_px + 1, 2)
    present = []
    for t in np.arange(0.0, length, step_px):
        xs = np.clip((x0 + ux * t + nx * offs).astype(int), 0, w - 1)
        ys = np.clip((y0 + uy * t + ny * offs).astype(int), 0, h - 1)
        present.append(bool((canopy[ys, xs] >= thr).any()))
    idx = np.nonzero(present)[0]
    if len(idx) < 2:
        return "unassessable"
    longest = int(np.diff(idx).max() - 1) if len(idx) > 1 else 0
    return "disrupted" if longest * step_px * GSD >= gap_m else "regular"


COVER_IDS = {2: "bare_soil", 3: "vegetation", 4: "mixed"}


def cover_from_counts(counts: dict[int, int]) -> str:
    """Majority of predicted cover classes (the model learns polygon-level cover per pixel)."""
    votes = {k: counts.get(k, 0) for k in COVER_IDS}
    if sum(votes.values()) == 0:
        return "unassessable"
    return COVER_IDS[max(votes, key=votes.get)]


def interrows_from_classes(
    cls: np.ndarray,
    rows: list[list[tuple[float, float]]],
    *,
    barrier_px: int = 6,
    min_area_px: int = 4000,
    simplify_px: float = 4.0,
) -> list[tuple[list[tuple[float, float]], str]]:
    """Inter-row polygons: cover-class pixels (2..4) cut along the row lines, one polygon per piece.

    Cover is the majority predicted cover class inside the piece.
    """
    import cv2
    from shapely.geometry import Polygon

    ground = np.isin(cls, list(COVER_IDS)).astype(np.uint8)
    for r in rows:
        (x0, y0), (x1, y1) = r[0], r[-1]
        cv2.line(ground, (int(round(x0)), int(round(y0))), (int(round(x1)), int(round(y1))), 0, thickness=barrier_px)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(ground, connectivity=4)
    out = []
    for k in range(1, n):
        if stats[k, cv2.CC_STAT_AREA] < min_area_px:
            continue
        comp = (labels == k).astype(np.uint8)
        vals, cnts = np.unique(cls[comp.astype(bool)], return_counts=True)
        cover = cover_from_counts(dict(zip(vals.tolist(), cnts.tolist())))
        contours, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        c = max(contours, key=cv2.contourArea)
        if len(c) < 3:
            continue
        poly = Polygon((float(x), float(y)) for x, y in c[:, 0, :]).simplify(simplify_px)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.geom_type == "MultiPolygon":
            poly = max(poly.geoms, key=lambda g: g.area)
        if poly.is_empty or poly.area < min_area_px:
            continue
        out.append(([(float(x), float(y)) for x, y in poly.exterior.coords], cover))
    return out
