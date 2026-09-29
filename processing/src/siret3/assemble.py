"""Assemble per-tile model output (projected to EPSG:32635) into blocks and stitched rows.

- Blocks (`vineyard_id`): connected parts of the vineyard footprint (rows, inter-rows and
  plants, buffered) after cutting out the official passages. Numbered north-west first.
- Rows (`row_id`): pieces from different tiles are one row when they are collinear, close
  sideways and end near each other. A row never holds two pieces from the same tile, so
  neighbouring rows cannot chain together. Numbered across the block (V01-R001, …).
- Inter-rows and waste take the block they overlap / are nearest to (≤ 10 m).
"""

from __future__ import annotations

import math

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

from .ids import ProjectedPoly, centroid

ROW_REACH_M = 1.5
PLANT_REACH_M = 1.5
WASTE_REACH_M = 10.0


def _geom(p: ProjectedPoly):
    if p.kind == "row":
        return LineString(p.coords)
    if len(p.coords) >= 3:
        g = Polygon(p.coords)
        return g if g.is_valid else g.buffer(0)
    return Point(p.coords[0])


def block_footprints(items: list[ProjectedPoly], passages=None) -> list:
    parts = []
    for p in items:
        if p.kind == "row" and len(p.coords) >= 2:
            parts.append(LineString(p.coords).buffer(ROW_REACH_M))
        elif p.kind == "interrow_area" and len(p.coords) >= 3:
            parts.append(_geom(p).buffer(0.3))
        elif p.kind == "vineyard" and len(p.coords) >= 3:
            parts.append(_geom(p).buffer(PLANT_REACH_M))
    if not parts:
        return []
    fp = unary_union(parts)
    if passages is not None and not passages.is_empty:
        fp = fp.difference(passages)
    polys = [g for g in getattr(fp, "geoms", [fp]) if g.geom_type == "Polygon" and g.area > 4.0]
    polys.sort(key=lambda g: (-round(g.centroid.y / 25.0), g.centroid.x))
    return polys


def _heading(coords) -> float:
    (x0, y0), (x1, y1) = coords[0], coords[-1]
    return math.atan2(y1 - y0, x1 - x0) % math.pi


def _joinable(a: ProjectedPoly, b: ProjectedPoly, *, max_angle_deg: float, max_offset_m: float, max_gap_m: float) -> bool:
    ha, hb = _heading(a.coords), _heading(b.coords)
    d = abs(ha - hb)
    if math.degrees(min(d, math.pi - d)) > max_angle_deg:
        return False
    la, lb = LineString(a.coords), LineString(b.coords)
    ux, uy = math.cos(ha), math.sin(ha)
    ax, ay = a.coords[0]
    # sideways offset of b's end points from a's infinite line
    off = max(abs(-(x - ax) * uy + (y - ay) * ux) for x, y in (b.coords[0], b.coords[-1]))
    if off > max_offset_m:
        return False
    ta = sorted(((x - ax) * ux + (y - ay) * uy) for x, y in (a.coords[0], a.coords[-1]))
    tb = sorted(((x - ax) * ux + (y - ay) * uy) for x, y in (b.coords[0], b.coords[-1]))
    gap = max(tb[0] - ta[1], ta[0] - tb[1], 0.0)
    return gap <= max_gap_m and la.distance(lb) <= max_gap_m


def join_rows(rows: list[ProjectedPoly], *, max_angle_deg: float = 6.0, max_offset_m: float = 0.6,
              max_gap_m: float = 3.0) -> list[list[int]]:
    """Group row pieces; best (smallest offset) pairs join first; one piece per tile per group."""
    n = len(rows)
    lines = [LineString(r.coords) for r in rows]
    tree = STRtree(lines)
    cands = []
    for i, li in enumerate(lines):
        for j in tree.query(li.buffer(max_gap_m)):
            j = int(j)
            if j <= i or rows[i].tile == rows[j].tile:
                continue
            if _joinable(rows[i], rows[j], max_angle_deg=max_angle_deg, max_offset_m=max_offset_m, max_gap_m=max_gap_m):
                cands.append((li.distance(lines[j]), i, j))
    parent = list(range(n))
    tiles = [{rows[i].tile} for i in range(n)]

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for _d, i, j in sorted(cands):
        ri, rj = find(i), find(j)
        if ri == rj or tiles[ri] & tiles[rj]:
            continue
        parent[rj] = ri
        tiles[ri] |= tiles[rj]
    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())


def assemble(items: list[ProjectedPoly], *, passages=None) -> list[ProjectedPoly]:
    blocks = block_footprints(items, passages)
    tree = STRtree(blocks) if blocks else None

    def block_of(p: ProjectedPoly, reach: float = 0.0) -> str | None:
        if tree is None:
            return None
        g = _geom(p)
        best, best_k = 0.0, None
        for k in tree.query(g.buffer(reach) if reach else g):
            k = int(k)
            inter = blocks[k].intersection(g)
            v = inter.area if g.geom_type == "Polygon" else inter.length if g.geom_type == "LineString" else 1.0
            if not inter.is_empty and v >= best:
                best, best_k = v, k
        if best_k is None and reach:
            d, best_k = min(((blocks[int(k)].distance(g), int(k)) for k in tree.query(g.buffer(reach))), default=(None, None))
        return None if best_k is None else f"V{best_k + 1:02d}"

    for p in items:
        if p.kind == "waste":
            p.vineyard_id = block_of(p, WASTE_REACH_M)
        elif p.kind in {"row", "interrow_area", "vineyard"}:
            p.vineyard_id = block_of(p)

    rows = [p for p in items if p.kind == "row"]
    by_block: dict[str | None, list[ProjectedPoly]] = {}
    for r in rows:
        by_block.setdefault(r.vineyard_id, []).append(r)
    for vid, group in by_block.items():
        clusters = join_rows(group)
        s = c = 0.0
        for r in group:
            h = _heading(r.coords)
            s, c = s + math.sin(2 * h) * LineString(r.coords).length, c + math.cos(2 * h) * LineString(r.coords).length
        h = 0.5 * math.atan2(s, c)
        nx, ny = -math.sin(h), math.cos(h)

        def across(idx: list[int]) -> float:
            pts = [pt for k in idx for pt in group[k].coords]
            x, y = centroid(pts)
            return -(x * nx + y * ny)  # north / left side first

        for seq, idx in enumerate(sorted(clusters, key=across), start=1):
            rid = f"{vid or 'V00'}-R{seq:03d}"
            for k in idx:
                group[k].row_id = rid
                group[k].extras = {**(group[k].extras or {}), "n_parts": len(idx)}
    return items
