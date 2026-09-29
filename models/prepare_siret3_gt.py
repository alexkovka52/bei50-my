#!/usr/bin/env python3
"""Marcaj ground truth (CVAT 1.1 export) → plant-seg, waste-detect and inter-row semseg datasets."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "processing" / "src"))

from siret3.marcaj import collect_cvat_images  # noqa: E402
from siret3.splits import load_split  # noqa: E402
from siret3.yolo_datasets import build_plant_seg, build_semseg, build_waste_det  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--export", default="data/marcaj_export/project37_cvat.zip")
    p.add_argument("--split", default="data/splits/siret3_split.json")
    p.add_argument("--tiles", default="data/tiles")
    p.add_argument("--out", default="datasets")
    p.add_argument("--only", choices=["plants", "waste", "semseg"], action="append")
    p.add_argument("--chip", type=int, default=1024)
    p.add_argument("--stride", type=int, default=512)
    args = p.parse_args()
    images = collect_cvat_images(Path(args.export))
    split = load_split(Path(args.split))
    out = Path(args.out)
    todo = args.only or ["plants", "waste", "semseg"]
    if "plants" in todo:
        st = build_plant_seg(images, Path(args.tiles), split, out / "siret3-gt-plants", chip=args.chip, stride=args.stride)
        print("plants", json.dumps(st))
    if "waste" in todo:
        st = build_waste_det(images, Path(args.tiles), split, out / "siret3-gt-waste", chip=args.chip, stride=args.stride)
        print("waste", json.dumps(st))
    if "semseg" in todo:
        st = build_semseg(images, Path(args.tiles), split, out / "siret3-gt-semseg")
        print("semseg", json.dumps(st))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
