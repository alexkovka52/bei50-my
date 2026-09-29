"""Chip geometry of models/infer_yolo.py (no ultralytics needed)."""

import importlib.util
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("cv2")
_spec = importlib.util.spec_from_file_location(
    "infer_yolo", Path(__file__).resolve().parents[2] / "models" / "infer_yolo.py"
)
infer_yolo = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(infer_yolo)


def test_chip_grid_covers_tile():
    grid = infer_yolo.chip_grid(2048, 2048, 1024, 768)
    assert sorted({g[0] for g in grid}) == [0, 768, 1024]
    assert all(w == 1024 and h == 1024 for *_, w, h in grid)


def test_every_pixel_is_in_some_core_and_border_cores_reach_edge():
    grid = infer_yolo.chip_grid(2048, 2048, 1024, 768)
    cores = [infer_yolo.core_of(x0, y0, w, h, 2048, 2048, 128) for x0, y0, w, h in grid]
    for cx in (0.5, 900.0, 1500.0, 2047.5):
        for cy in (0.5, 1000.0, 2047.5):
            assert any(infer_yolo.in_core(cx, cy, c) for c in cores)
    # A plant centred 10 px from the right edge of the first chip is not taken from it.
    assert not infer_yolo.in_core(1014, 500, cores[0])


def test_mask_to_ring_largest_contour():
    m = np.zeros((100, 100), dtype=bool)
    m[10:40, 10:30] = True
    m[80:82, 80:82] = True
    ring = infer_yolo.mask_to_ring(m)
    xs = [p[0] for p in ring]
    assert ring[0] == ring[-1] and min(xs) >= 10 and max(xs) <= 30.5


def test_nms_drops_duplicate_across_chips():
    a = {"ring": [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], "score": 0.9}
    b = {"ring": [[1, 0], [10, 0], [10, 10], [1, 10], [1, 0]], "score": 0.8}
    c = {"ring": [[20, 0], [30, 0], [30, 10], [20, 10], [20, 0]], "score": 0.7}
    assert [d["score"] for d in infer_yolo._nms([a, b, c], 0.5)] == [0.9, 0.7]
