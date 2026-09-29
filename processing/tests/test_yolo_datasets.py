"""GT (Marcaj CVAT) → YOLO-seg / YOLO-detect / semseg datasets."""

from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

from siret3.cvat11 import CvatImage, CvatShape
from siret3.yolo_datasets import (
    COVER_CLASSES,
    IGNORE,
    build_plant_seg,
    build_semseg,
    build_waste_det,
    clip_box_to_chip,
    clip_polygon_to_chip,
    semseg_mask,
)


def test_clip_polygon_keeps_cut_plant_clipped_to_chip():
    # 20×20 square straddling the right edge of a 100-px chip at x0=0.
    square = [(90, 10), (110, 10), (110, 30), (90, 30)]
    rings = clip_polygon_to_chip(square, 0, 0, 100, 100, min_frac=0.3, min_area=10)
    assert len(rings) == 1
    xs = [p[0] for p in rings[0]]
    assert max(xs) <= 100 and min(xs) >= 90
    # Shifted into the next chip it is also kept, in chip coordinates.
    rings2 = clip_polygon_to_chip(square, 100, 0, 100, 100, min_frac=0.3, min_area=10)
    assert len(rings2) == 1 and min(p[0] for p in rings2[0]) >= 0 and max(p[0] for p in rings2[0]) <= 10


def test_clip_polygon_drops_tiny_sliver():
    square = [(98, 10), (140, 10), (140, 50), (98, 50)]  # only 2 px of 42 inside
    assert clip_polygon_to_chip(square, 0, 0, 100, 100, min_frac=0.3, min_area=200) == []


def test_clip_polygon_repairs_self_intersection():
    bowtie = [(10, 10), (30, 30), (30, 10), (10, 30)]
    rings = clip_polygon_to_chip(bowtie, 0, 0, 100, 100, min_frac=0.3, min_area=1)
    assert len(rings) == 2


def test_clip_box():
    assert clip_box_to_chip((90, 10, 110, 30), 0, 0, 100, 100, min_frac=0.4) == (90, 10, 100, 30)
    assert clip_box_to_chip((95, 10, 135, 30), 0, 0, 100, 100, min_frac=0.4) is None


def _shapes():
    return [
        CvatShape(tag="polygon", label="interrow_area", points=[(0, 40), (64, 40), (64, 60), (0, 60)],
                  attributes={"interrow_cover": "vegetation"}),
        CvatShape(tag="polygon", label="interrow_area", points=[(0, 0), (64, 0), (64, 10), (0, 10)],
                  attributes={}),
        CvatShape(tag="polygon", label="vineyard", points=[(10, 45), (20, 45), (20, 55), (10, 55)]),
        CvatShape(tag="box", label="waste", xtl=40, ytl=20, xbr=50, ybr=30),
    ]


def test_semseg_mask_layers_canopy_over_cover_and_ignores_unset():
    mask = semseg_mask(_shapes(), 64, 64)
    assert mask[50, 5] == COVER_CLASSES["vegetation"]
    assert mask[50, 15] == 1  # canopy on top of the inter-row
    assert mask[5, 5] == IGNORE  # inter-row without cover
    assert mask[30, 5] == 0


def _tile(path: Path, size: int = 64) -> None:
    with rasterio.open(path, "w", driver="GTiff", height=size, width=size, count=3, dtype="uint8",
                       crs="EPSG:32635", transform=from_origin(629000, 5220000, 0.025, 0.025)) as dst:
        dst.write(np.full((3, size, size), 120, dtype="uint8"))


def test_builders_write_split_dirs(tmp_path: Path):
    tiles = tmp_path / "tiles"
    tiles.mkdir()
    names = ["siret3_r000_c000.tif", "siret3_r000_c001.tif", "siret3_r004_c004.tif"]
    for n in names:
        _tile(tiles / n)
    images = [
        CvatImage(name=names[0], width=64, height=64, shapes=_shapes()),
        CvatImage(name=names[1], width=64, height=64, shapes=[]),
        CvatImage(name=names[2], width=64, height=64, shapes=_shapes()),
    ]
    split = {names[0]: "train", names[1]: "train", names[2]: "val"}
    stale = tmp_path / "plants" / "images" / "train" / "stale.png"
    stale.parent.mkdir(parents=True)
    stale.write_bytes(b"x")

    st = build_plant_seg(images, tiles, split, tmp_path / "plants", chip=32, stride=32, empty_keep=1.0, min_area=10)
    assert not stale.exists()
    assert st["train"]["instances"] >= 1 and st["val"]["instances"] >= 1
    assert (tmp_path / "plants" / "plants.yaml").read_text().count("vineyard") == 1

    sw = build_waste_det(images, tiles, split, tmp_path / "waste", chip=32, stride=32, oversample=3, neg_per_tile=1)
    assert sw["train"]["boxes"] == 3  # one box, oversampled ×3 in train
    assert sw["val"]["boxes"] == 1

    ss = build_semseg(images, tiles, split, tmp_path / "semseg")
    assert ss["train"] == 2 and ss["val"] == 1
    assert (tmp_path / "semseg" / "masks" / "siret3_r000_c000.png").is_file()
    assert (tmp_path / "semseg" / "rowmasks" / "siret3_r000_c000.png").is_file()


def test_row_mask_buffers_polyline():
    from siret3.yolo_datasets import row_mask

    m = row_mask([CvatShape(tag="polyline", label="row", points=[(10, 32), (54, 32)])], 64, 64, half_width_px=4)
    assert m[32, 30] == 1 and m[35, 30] == 1 and m[40, 30] == 0 and m[32, 5] == 0


def test_split_strip_cuts_row_polygon_into_plant_pitch_pieces():
    from shapely.geometry import Polygon

    from siret3.yolo_datasets import split_strip

    strip = [(0, 0), (500, 0), (500, 30), (0, 30)]  # 12.5 m × 0.75 m row strip
    pieces = split_strip(strip, pitch_px=50, max_len_px=150)
    assert len(pieces) == 10
    assert abs(sum(Polygon(p).area for p in pieces) - 500 * 30) < 1
    plant = [(0, 0), (40, 0), (40, 30), (0, 30)]
    assert split_strip(plant, pitch_px=50, max_len_px=150) == [plant]


def test_tiles_with_fields_but_no_rows_are_plant_negatives():
    from siret3.yolo_datasets import _has_structure_without_plants

    field = CvatImage(name="siret3_r000_c000.tif", width=64, height=64, shapes=[_shapes()[1]])
    assert not _has_structure_without_plants(field)
    rows = CvatImage(name="siret3_r000_c000.tif", width=64, height=64,
                     shapes=[CvatShape(tag="polyline", label="row", points=[(0, 0), (60, 0)])])
    assert _has_structure_without_plants(rows)
