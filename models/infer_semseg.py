#!/usr/bin/env python3
"""Cover + row-line semseg over siret3 tiles → per-tile pixel GeoJSON of rows and inter-rows.

- rows: row-line model → `rows_from_prob` polylines; `row_structure` from canopy gaps (cover model).
- inter-rows: cover classes cut along the rows → one polygon per piece, majority cover.
Also writes the cover class map (`classes/<tile>.png`) for pixel scoring.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "processing" / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from siret3.rows_from_mask import interrows_from_classes, row_structure_from_canopy, rows_from_prob  # noqa: E402
from train_semseg import build_model, predict_tile, read_rgb  # noqa: E402


def load(path: str):
    ck = torch.load(path, map_location="cuda", weights_only=False)
    model = build_model(ck["arch"], ck["encoder"], len(ck["classes"]))
    model.load_state_dict(ck["state_dict"])
    return model.cuda().eval(), ck["classes"]


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--cover", required=True, help="cover checkpoint (bg/canopy/bare/veg/mixed)")
    p.add_argument("--rows", required=True, help="row-line checkpoint")
    p.add_argument("--tiles", default="data/tiles")
    p.add_argument("--out", default="data/predictions_semseg")
    p.add_argument("--only", nargs="*")
    p.add_argument("--row-thr", type=float, default=0.5)
    args = p.parse_args()

    tiles = sorted(Path(args.tiles).glob("siret3_r*_c*.tif"))
    if args.only:
        tiles = [t for t in tiles if t.name in set(args.only)]
    out = Path(args.out)
    (out / "classes").mkdir(parents=True, exist_ok=True)
    cover_model, cover_names = load(args.cover)
    rows_model, _ = load(args.rows)

    from PIL import Image

    for tile in tiles:
        rgb = read_rgb(tile)
        prob = predict_tile(cover_model, rgb, n_classes=len(cover_names))
        cls = prob.argmax(0).astype(np.uint8)
        canopy = prob[1]
        row_prob = predict_tile(rows_model, rgb, n_classes=2)[1]
        Image.fromarray(cls).save(out / "classes" / f"{tile.stem}.png", compress_level=1)
        rows = rows_from_prob(row_prob, thr=args.row_thr)
        feats = []
        for r in rows:
            feats.append({
                "type": "Feature",
                "properties": {"kind": "row", "tile": tile.name, "row_structure": row_structure_from_canopy(r, canopy)},
                "geometry": {"type": "LineString", "coordinates": [list(pt) for pt in r]},
            })
        for ring, cover in interrows_from_classes(cls, rows):
            feats.append({
                "type": "Feature",
                "properties": {"kind": "interrow_area", "tile": tile.name, "interrow_cover": cover},
                "geometry": {"type": "Polygon", "coordinates": [[list(pt) for pt in ring]]},
            })
        (out / f"{tile.stem}.geojson").write_text(
            json.dumps({"type": "FeatureCollection", "tile": tile.name, "features": feats}), encoding="utf-8")
        print(tile.name, "rows", len(rows), "interrows", len(feats) - len(rows), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
