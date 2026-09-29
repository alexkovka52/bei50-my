"""Build Dementra logo concepts as clean filled SVG paths (shapely booleans)."""
import math
from shapely.geometry import Polygon, Point, LineString, box
from shapely.affinity import rotate
from shapely.ops import unary_union

def path_d(geom, nd=2):
    parts = getattr(geom, "geoms", [geom])
    out = []
    for p in parts:
        for ring in [p.exterior, *p.interiors]:
            c = list(ring.coords)[:-1]
            out.append("M" + " L".join(f"{x:.{nd}f} {y:.{nd}f}" for x, y in c) + " Z")
    return " ".join(out)

def svg(geom, fill="#000", view="0 0 256 256"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}">'
            f'<path fill="{fill}" fill-rule="evenodd" d="{path_d(geom)}"/></svg>\n')

def semicircle_D(x0=52, top=36, h=184, r=None):
    r = r or h / 2
    cx, cy = x0 + (h * 0.40), top + h / 2
    pts = [(x0, top), (cx, top)]
    for k in range(0, 181, 2):
        a = math.radians(-90 + k)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    pts += [(cx, top + h), (x0, top + h)]
    return Polygon(pts)

def rows(angle_deg, width, pitch, extent=400, center=(128, 128), n=12, offset=0.0):
    bars = []
    for i in range(-n, n + 1):
        b = box(-extent, -width / 2, extent, width / 2)
        b = rotate(b, 0).buffer(0)
        from shapely.affinity import translate
        b = translate(b, center[0], center[1] + i * pitch + offset)
        bars.append(rotate(b, -angle_deg, origin=center))
    return unary_union(bars)

# A — Field D: D silhouette with diagonal row slots cut through (negative space)
D = semicircle_D()
slots = rows(32, 13, 40, offset=6)
A = D.difference(slots).buffer(0)
open("a-field-d.svg", "w").write(svg(A))

# B — Tendril: a curl that straightens into a row line (thick monoline, round caps)
pts = []
cx, cy = 104, 112
turns = 1.15
for k in range(0, 200):
    t = k / 199
    ang = math.pi * 2 * turns * t + math.pi * 0.5
    r = 16 + 46 * t
    pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
end = pts[-1]
# tangent continuation into a straight row heading down-right
tx, ty = pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1]
L = math.hypot(tx, ty); tx, ty = tx / L, ty / L
line_end = (end[0] + tx * 96, end[1] + ty * 96)
B = LineString(pts + [line_end]).buffer(15, cap_style=1, join_style=1)
open("b-tendril.svg", "w").write(svg(B))

# C — The Gap: rows seen through a round lens, one row broken with a dot in the gap
lens = Point(128, 128).buffer(106, resolution=64)
r = rows(35, 24, 44)
bars = r.intersection(lens)
gap = rotate(box(128 - 30, 128 - 20, 128 + 30, 128 + 20), -35, origin=(128, 128))
bars = bars.difference(gap)
dot = Point(128, 128).buffer(10, resolution=32)
C = unary_union([bars, dot]).buffer(0)
open("c-the-gap.svg", "w").write(svg(C))
print("ok", A.area, B.area, C.area)
