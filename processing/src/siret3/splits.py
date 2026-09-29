"""Spatial train/val/test split: whole blocks of neighbouring tiles go to one subset.

Marcaj's own split is random per tile, so neighbouring tiles (and the same vine rows)
land in both train and val. Grouping tiles into `block`×`block` grid cells stops that.
"""

from __future__ import annotations

import json
import random
import re
from collections import Counter
from pathlib import Path

from .cvat11 import CvatImage

_RC = re.compile(r"siret3_r(\d+)_c(\d+)", re.I)
REQUIRED_COVERS = ("bare_soil", "vegetation", "mixed")


def block_of(name: str, block: int) -> tuple[int, int]:
    m = _RC.search(name)
    if not m:
        raise ValueError(f"not a Sireț3 tile name: {name}")
    return (int(m.group(1)) // block, int(m.group(2)) // block)


def _stats(images: list[CvatImage], block: int) -> dict[tuple[int, int], Counter]:
    out: dict[tuple[int, int], Counter] = {}
    for im in images:
        st = out.setdefault(block_of(im.name, block), Counter())
        for s in im.shapes:
            if s.label == "vineyard":
                st["plants"] += 1
            elif s.label == "waste":
                st["waste"] += 1
            elif s.label == "interrow_area":
                cover = (s.attributes or {}).get("interrow_cover")
                if cover:
                    st[cover] += 1
    return out


def _ok(chosen: list[tuple[int, int]], stats: dict[tuple[int, int], Counter]) -> bool:
    total = Counter()
    for b in chosen:
        total.update(stats[b])
    return total["waste"] > 0 and all(total[c] > 0 for c in REQUIRED_COVERS)


def spatial_split(
    images: list[CvatImage],
    *,
    block: int = 4,
    val_frac: float = 0.15,
    test_frac: float = 0.10,
    seed: int = 0,
    max_tries: int = 500,
) -> dict[str, str]:
    """Map every image name to train / val / test. Fractions are of labelled plants.

    Tries seeds from `seed` upwards until both val and test contain waste and every cover class.
    """
    stats = _stats(images, block)
    total_plants = sum(st["plants"] for st in stats.values()) or 1
    for attempt in range(max_tries):
        rng = random.Random(seed + attempt)
        order = sorted(stats)
        rng.shuffle(order)
        subsets: dict[tuple[int, int], str] = {}
        picked: dict[str, list[tuple[int, int]]] = {"test": [], "val": []}
        for sub, frac in (("test", test_frac), ("val", val_frac)):
            plants = 0
            for b in order:
                if b in subsets or plants >= frac * total_plants:
                    continue
                subsets[b] = sub
                picked[sub].append(b)
                plants += stats[b]["plants"]
        if _ok(picked["test"], stats) and _ok(picked["val"], stats):
            return {im.name: subsets.get(block_of(im.name, block), "train") for im in images}
    raise RuntimeError("no seed gave val and test with waste and every cover class")


def write_split(split: dict[str, str], out: Path, **meta) -> None:
    from .example_yolo import canonical_tile_name

    tiles = {canonical_tile_name(k): v for k, v in sorted(split.items())}
    counts = Counter(tiles.values())
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"meta": meta, "counts": counts, "tiles": tiles}, indent=1), encoding="utf-8")


def load_split(path: Path) -> dict[str, str]:
    return json.loads(Path(path).read_text(encoding="utf-8"))["tiles"]
