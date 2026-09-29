"""Row polylines from a row-line probability map, structure from canopy gaps."""

import numpy as np
import pytest

pytest.importorskip("cv2")
from siret3.rows_from_mask import row_structure_from_canopy, rows_from_prob  # noqa: E402


def _draw(m, p0, p1, w=8):
    import cv2

    cv2.line(m, p0, p1, 1.0, thickness=2 * w)


def test_three_parallel_rows_and_a_gap_is_bridged():
    prob = np.zeros((1000, 1000), dtype=np.float32)
    _draw(prob, (100, 100), (900, 100))
    _draw(prob, (100, 200), (400, 200))
    _draw(prob, (600, 200), (900, 200))  # same row, 8 m gap → one row
    _draw(prob, (100, 300), (900, 310))
    rows = rows_from_prob(prob)
    assert len(rows) == 3
    ys = sorted(round((a[1] + b[1]) / 2) for a, b in rows)
    assert abs(ys[0] - 100) <= 2 and abs(ys[1] - 200) <= 2 and abs(ys[2] - 305) <= 2
    lens = sorted(np.hypot(b[0] - a[0], b[1] - a[1]) for a, b in rows)
    assert all(l > 780 for l in lens)


def test_neighbouring_rows_are_not_merged():
    prob = np.zeros((600, 600), dtype=np.float32)
    _draw(prob, (50, 100), (550, 100))
    _draw(prob, (50, 190), (550, 190))  # 2.25 m apart
    assert len(rows_from_prob(prob)) == 2


def test_structure_from_canopy_gap():
    canopy = np.zeros((200, 1000), dtype=np.float32)
    canopy[95:105, 0:300] = 1
    canopy[95:105, 600:1000] = 1  # 300 px = 7.5 m gap
    row = [(0.0, 100.0), (1000.0, 100.0)]
    assert row_structure_from_canopy(row, canopy) == "disrupted"
    canopy[95:105, 300:600:40] = 1  # plants every 1 m
    assert row_structure_from_canopy(row, canopy) == "regular"


def test_interrows_are_cut_by_rows_and_take_majority_cover():
    from siret3.rows_from_mask import interrows_from_classes

    cls = np.zeros((300, 400), dtype=np.uint8)
    cls[100:200, 20:380] = 2  # bare soil band between two rows...
    cls[150:200, 20:380] = 3  # ...lower half vegetation
    cls[130:170, 20:380] = 3  # → rows split it at y=150 (upper mostly bare, lower veg)
    rows = [[(0.0, 100.0), (400.0, 100.0)], [(0.0, 150.0), (400.0, 150.0)], [(0.0, 200.0), (400.0, 200.0)]]
    out = interrows_from_classes(cls, rows, min_area_px=500)
    assert len(out) == 2
    covers = sorted(c for _ring, c in out)
    assert covers == ["bare_soil", "vegetation"]
