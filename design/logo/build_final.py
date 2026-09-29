"""Final Dementra mark (concept C, The Gap): full mark and a 3-row small-size cut."""
import math
from shapely.geometry import Point, LineString
from shapely.ops import unary_union

def d_of(g, nd=1):
    out = []
    for p in getattr(g, "geoms", [g]):
        p = p.simplify(0.3, preserve_topology=True)
        for ring in [p.exterior, *p.interiors]:
            c = list(ring.coords)[:-1]
            out.append("M" + " ".join(f"{x:.{nd}f} {y:.{nd}f}" for x, y in c) + "Z")
    return "".join(out)

def mark(n_side, pitch, w, gap, dot_r, R=106):
    lens = Point(128, 128).buffer(R, resolution=96)
    a = math.radians(-30); u = (math.cos(a), math.sin(a)); n = (-u[1], u[0])
    bars = []
    for i in range(-n_side, n_side + 1):
        oc = (128 + n[0] * i * pitch, 128 + n[1] * i * pitch)
        far = lambda s: (oc[0] + u[0] * s, oc[1] + u[1] * s)
        if i == 0:
            bars += [LineString([far(-300), far(-gap)]).buffer(w / 2, resolution=24),
                     LineString([far(gap), far(300)]).buffer(w / 2, resolution=24)]
        else:
            bars.append(LineString([far(-300), far(300)]).buffer(w / 2, cap_style=2))
    rows = unary_union(bars).intersection(lens)
    rows = unary_union([p for p in getattr(rows, "geoms", [rows]) if p.area > 200])
    dot = Point(128, 128).buffer(dot_r, resolution=48) if dot_r else None
    return rows, dot

def svg(rows, dot, rows_fill, dot_fill, bg=None, radius=56):
    bgs = f'<rect width="256" height="256" rx="{radius}" fill="{bg}"/>' if bg else ""
    dots = f'<path fill="{dot_fill}" d="{d_of(dot)}"/>' if dot is not None else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">{bgs}'
            f'<path fill="{rows_fill}" d="{d_of(rows)}"/>{dots}</svg>\n')

rows, dot = mark(3, 44, 24, 34, 9.5)
srows, _ = mark(1, 70, 40, 44, 0, R=112)
files = {
  "dementra-mark.svg": svg(rows, dot, "#0F2A1D", "#0F2A1D"),
  "dementra-mark-reversed.svg": svg(rows, dot, "#E3EED4", "#D6F26B"),
  "dementra-mark-small.svg": svg(srows, None, "#0F2A1D", None),
  "dementra-icon.svg": svg(mark(3, 44, 24, 34, 9.5, R=92)[0], mark(3, 44, 24, 34, 9.5, R=92)[1], "#E3EED4", "#D6F26B", bg="#0F2A1D"),
  "dementra-icon-small.svg": svg(mark(1, 64, 38, 40, 0, R=96)[0], None, "#E3EED4", None, bg="#0F2A1D"),
}
for k, v in files.items(): open(k, "w").write(v); print(k, len(v))
