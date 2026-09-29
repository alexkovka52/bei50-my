import math
from shapely.geometry import Polygon, Point, LineString, box
from shapely.affinity import rotate, translate, scale
from shapely.ops import unary_union
from build_concepts import svg, rows

def fit(g, pad=24, size=256):
    x0, y0, x1, y1 = g.bounds
    s = (size - 2 * pad) / max(x1 - x0, y1 - y0)
    g = scale(g, s, s, origin=(x0, y0))
    x0, y0, x1, y1 = g.bounds
    return translate(g, (size - (x1 - x0)) / 2 - x0, (size - (y1 - y0)) / 2 - y0 - 2)  # optical: 2px up

def drop_slivers(g, min_area=260):
    parts = [p for p in getattr(g, "geoms", [g]) if p.area >= min_area]
    return unary_union(parts)

# A v2 — Field D, centred, 4 bands, no slivers
h = 200; r = h / 2; x0 = 0
pts = [(0, 0), (0.42 * h, 0)]
for k in range(0, 181, 2):
    a = math.radians(-90 + k); pts.append((0.42 * h + r * math.cos(a), r + r * math.sin(a)))
pts += [(0.42 * h, h), (0, h)]
D = Polygon(pts)
c = D.centroid
slots = rows(30, 15, 46, center=(c.x, c.y), offset=0)
A = drop_slivers(D.difference(slots).buffer(0))
A = fit(A, pad=30)
open("a-field-d-v2.svg", "w").write(svg(A))

# B v2 — Tendril resolving into a horizontal row line
pts = []
turns = 1.1
for k in range(240):
    t = k / 239
    ang = -2 * math.pi * turns * (1 - t)
    rr = 14 + 50 * t
    pts.append((rr * math.cos(ang), rr * math.sin(ang)))
(ax, ay), (bx, by) = pts[-2], pts[-1]
heading = math.atan2(by - ay, bx - ax)
line = pts + [(bx + 120 * math.cos(heading), by + 120 * math.sin(heading))]
B = LineString(line).buffer(15, cap_style=1, join_style=1, resolution=24)
B = rotate(B, -math.degrees(heading), origin=(bx, by))
B = fit(B, pad=26)
open("b-tendril-v2.svg", "w").write(svg(B))

# C v2 — The Gap, round-capped broken row
R = 106
lens = Point(128, 128).buffer(R, resolution=96)
ang = math.radians(-30)
u = (math.cos(ang), math.sin(ang)); n = (-u[1], u[0])
bars = []
pitch, w = 44, 24
for i in range(-3, 4):
    oc = (128 + n[0] * i * pitch, 128 + n[1] * i * pitch)
    seg = LineString([(oc[0] - u[0] * 300, oc[1] - u[1] * 300), (oc[0] + u[0] * 300, oc[1] + u[1] * 300)])
    if i == 0:
        gap = 34
        left = LineString([(oc[0] - u[0] * 300, oc[1] - u[1] * 300), (oc[0] - u[0] * gap, oc[1] - u[1] * gap)])
        right = LineString([(oc[0] + u[0] * gap, oc[1] + u[1] * gap), (oc[0] + u[0] * 300, oc[1] + u[1] * 300)])
        bars += [left.buffer(w / 2, cap_style=1, resolution=24), right.buffer(w / 2, cap_style=1, resolution=24)]
    else:
        bars.append(seg.buffer(w / 2, cap_style=2))
rowsg = unary_union(bars).intersection(lens)
dot = Point(128, 128).buffer(9.5, resolution=48)
C = drop_slivers(unary_union([rowsg, dot]).buffer(0), 200)
open("c-the-gap-v2.svg", "w").write(svg(C))
print("ok")
