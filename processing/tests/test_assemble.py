"""Block IDs, cross-tile row joining and numbering on the projected layer (EPSG:32635 metres)."""

from siret3.assemble import assemble
from siret3.ids import ProjectedPoly


def _row(x0, y, x1, tile, s="regular"):
    return ProjectedPoly(kind="row", coords=[(x0, y), (x1, y)], tile=tile, row_structure=s)


def test_rows_join_across_tile_edge_but_neighbours_stay_apart():
    rows = []
    for k in range(4):  # four rows 2.5 m apart crossing the edge x=51.2 between tiles A and B
        y = 10 + 2.5 * k
        rows += [_row(5, y, 51.1, "A"), _row(51.3, y + 0.1, 90, "B")]
    ir = ProjectedPoly(kind="interrow_area", coords=[(5, 10.4), (90, 10.4), (90, 12.1), (5, 12.1), (5, 10.4)],
                       tile="A", interrow_cover="bare_soil")
    out = assemble(rows + [ir])
    got = [p for p in out if p.kind == "row"]
    ids = {p.row_id for p in got}
    assert len(ids) == 4
    assert {p.vineyard_id for p in out} == {"V01"}
    by_id = {}
    for p in got:
        by_id.setdefault(p.row_id, set()).add(p.tile)
    assert all(t == {"A", "B"} for t in by_id.values())
    assert sorted(ids) == ["V01-R001", "V01-R002", "V01-R003", "V01-R004"]


def test_two_pieces_in_one_tile_are_never_one_row_and_far_blocks_split():
    rows = [_row(0, 0, 20, "A"), _row(22, 0.2, 40, "A"), _row(300, 0, 340, "C")]
    out = assemble(rows)
    got = [p for p in out if p.kind == "row"]
    assert len({p.row_id for p in got}) == 3
    assert len({p.vineyard_id for p in got}) == 2


def test_passage_splits_blocks():
    from shapely.geometry import box

    rows = [_row(0, 0, 40, "A"), _row(0, 2.5, 40, "A"), _row(0, 6.5, 40, "A"), _row(0, 9, 40, "A")]
    road = box(-10, 4.0, 60, 5.0)
    out = assemble(rows, passages=road)
    assert len({p.vineyard_id for p in out}) == 2
