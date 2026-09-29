"""Inspection targets from ≥ 5 m planting gaps. Not a Marcaj label."""

from __future__ import annotations

from collections import defaultdict

from .derive import GAP_M, _along_coord
from .ids import ProjectedPoly, centroid


def inspections_from_canopies(items: list[ProjectedPoly], *, max_row_dist_m: float = 1.5) -> list[ProjectedPoly]:
    """Gap midpoints along each row. Plants go to the nearest row *line* of their block."""
    import math

    from shapely.geometry import LineString, Point
    from shapely.strtree import STRtree

    rows = [p for p in items if p.kind == "row" and len(p.coords) >= 2]
    vines = [p for p in items if p.kind == "vineyard"]
    if not rows:
        return []
    lines = [LineString(r.coords) for r in rows]
    tree = STRtree(lines)
    plants_by_row: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for v in vines:
        vc = centroid(v.coords)
        pt = Point(vc)
        best, best_d = None, max_row_dist_m
        for k in tree.query(pt.buffer(max_row_dist_m)):
            r = rows[int(k)]
            if v.vineyard_id and r.vineyard_id and r.vineyard_id != v.vineyard_id:
                continue
            d = lines[int(k)].distance(pt)
            if d <= best_d:
                best, best_d = r, d
        if best is not None:
            plants_by_row[best.row_id or f"UNK-{id(best)}"].append(vc)

    pieces: dict[str, list[ProjectedPoly]] = defaultdict(list)
    for r in rows:
        pieces[r.row_id or f"UNK-{id(r)}"].append(r)
    out: list[ProjectedPoly] = []
    for rid, cents in plants_by_row.items():
        if len(cents) < 2:
            continue
        s = c = 0.0
        for r in pieces[rid]:
            (x0, y0), (x1, y1) = r.coords[0], r.coords[-1]
            h = math.atan2(y1 - y0, x1 - x0)
            w = math.hypot(x1 - x0, y1 - y0)
            s, c = s + math.sin(2 * h) * w, c + math.cos(2 * h) * w
        heading = (0.5 * math.atan2(s, c)) % math.pi
        row = pieces[rid][0]
        ordered = sorted(cents, key=lambda p: _along_coord(p, heading))
        n = 0
        for a, b in zip(ordered, ordered[1:]):
            gap = abs(_along_coord(b, heading) - _along_coord(a, heading))
            if gap < GAP_M:
                continue
            n += 1
            mid = ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)
            out.append(
                ProjectedPoly(
                    kind="inspection",
                    coords=[mid],
                    tile=row.tile,
                    vineyard_id=row.vineyard_id,
                    row_id=row.row_id,
                    extras={"id": f"INS-{rid}-{n:02d}", "gap_m": round(gap, 3)},
                )
            )
    return out


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def waste_targets(items: list[ProjectedPoly]) -> list[tuple[float, float]]:
    return [centroid(p.coords) for p in items if p.kind == "waste" and p.coords]


def parse_targets(raw: str) -> set[str]:
    parts = {p.strip().lower() for p in (raw or "").split(",") if p.strip()}
    allowed = {"inspections", "waste"}
    unknown = parts - allowed
    if unknown:
        raise ValueError(f"unknown route targets {sorted(unknown)}; use inspections,waste")
    return parts or {"inspections", "waste"}


def select_waypoints(items: list[ProjectedPoly], targets: set[str]) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    if "inspections" in targets:
        existing = [centroid(p.coords) for p in items if p.kind == "inspection" and p.coords]
        if existing:
            pts.extend(existing)
        else:
            pts.extend(centroid(p.coords) for p in inspections_from_canopies(items) if p.coords)
    if "waste" in targets:
        pts.extend(waste_targets(items))
    return pts
