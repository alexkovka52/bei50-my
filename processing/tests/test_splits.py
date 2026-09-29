"""Spatial train/val/test split over the tile grid."""

from siret3.cvat11 import CvatImage, CvatShape
from siret3.splits import block_of, spatial_split


def _img(r: int, c: int, plants: int = 5, waste: int = 0, covers=("bare_soil",)) -> CvatImage:
    shapes = [CvatShape(tag="polygon", label="vineyard", points=[(0, 0), (1, 0), (1, 1)]) for _ in range(plants)]
    shapes += [CvatShape(tag="box", label="waste", xtl=0, ytl=0, xbr=1, ybr=1) for _ in range(waste)]
    shapes += [
        CvatShape(tag="polygon", label="interrow_area", points=[(0, 0), (1, 0), (1, 1)], attributes={"interrow_cover": cv})
        for cv in covers
    ]
    return CvatImage(name=f"siret3_r{r:03d}_c{c:03d}.tif", width=2048, height=2048, shapes=shapes)


def _grid() -> list[CvatImage]:
    out = []
    for r in range(16):
        for c in range(16):
            waste = 1 if (r * 16 + c) % 17 == 0 else 0
            covers = ("bare_soil", "vegetation", "mixed")[: 1 + (r + c) % 3]
            out.append(_img(r, c, waste=waste, covers=covers))
    return out


def test_block_of_groups_neighbouring_tiles():
    assert block_of("siret3_r005_c004.tif", 4) == (1, 1)
    assert block_of("1638_siret3_r007_c007.tif", 4) == (1, 1)
    assert block_of("siret3_r008_c004.tif", 4) == (2, 1)


def test_split_is_disjoint_by_block_and_deterministic():
    images = _grid()
    split = spatial_split(images, block=4, val_frac=0.15, test_frac=0.10, seed=0)
    assert split == spatial_split(images, block=4, val_frac=0.15, test_frac=0.10, seed=0)
    assert set(split) == {im.name for im in images}
    blocks: dict[tuple[int, int], set[str]] = {}
    for name, sub in split.items():
        blocks.setdefault(block_of(name, 4), set()).add(sub)
    assert all(len(v) == 1 for v in blocks.values())
    for sub in ("val", "test"):
        names = [n for n, s in split.items() if s == sub]
        assert names
        assert any(s.label == "waste" for im in images if im.name in names for s in im.shapes)
        covers = {
            s.attributes.get("interrow_cover")
            for im in images
            if im.name in names
            for s in im.shapes
            if s.label == "interrow_area"
        }
        assert {"bare_soil", "vegetation", "mixed"} <= covers
