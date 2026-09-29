from siret3.ids import ProjectedPoly
from siret3.inspect import inspections_from_canopies, select_waypoints


def _plant(x: float, y: float, vid: str = "V01") -> ProjectedPoly:
    return ProjectedPoly(
        kind="vineyard",
        vineyard_id=vid,
        coords=[(x - 0.1, y - 0.1), (x + 0.1, y - 0.1), (x + 0.1, y + 0.1), (x - 0.1, y + 0.1)],
        tile="siret3_r001_c001.tif",
    )


def test_gap_over_five_metres_emits_one_inspection():
    plants = [_plant(0.0, 0.0), _plant(1.2, 0.0), _plant(7.4, 0.0), _plant(8.6, 0.0)]
    row = ProjectedPoly(
        kind="row",
        vineyard_id="V01",
        row_id="V01-R01",
        row_structure="disrupted",
        coords=[(0.0, 0.0), (8.6, 0.0)],
        tile="siret3_r001_c001.tif",
    )
    out = inspections_from_canopies(plants + [row])
    assert len(out) == 1
    ins = out[0]
    assert ins.kind == "inspection"
    assert ins.vineyard_id == "V01"
    assert ins.row_id == "V01-R01"
    assert ins.extras and ins.extras.get("id", "").startswith("INS-")
    cx = sum(c[0] for c in ins.coords) / len(ins.coords)
    assert 3.5 < cx < 5.0


def test_regular_row_emits_no_inspection():
    plants = [_plant(i * 1.2, 0.0) for i in range(5)]
    row = ProjectedPoly(
        kind="row",
        vineyard_id="V01",
        row_id="V01-R01",
        row_structure="regular",
        coords=[(0.0, 0.0), (4.8, 0.0)],
        tile="siret3_r001_c001.tif",
    )
    assert inspections_from_canopies(plants + [row]) == []


def test_select_waypoints_inspector_includes_gap_and_waste():
    plants = [_plant(0.0, 0.0), _plant(1.2, 0.0), _plant(7.4, 0.0), _plant(8.6, 0.0)]
    row = ProjectedPoly(
        kind="row",
        vineyard_id="V01",
        row_id="V01-R01",
        row_structure="disrupted",
        coords=[(0.0, 0.0), (8.6, 0.0)],
        tile="siret3_r001_c001.tif",
    )
    waste = ProjectedPoly(
        kind="waste",
        vineyard_id="V01",
        coords=[(1.0, 3.0), (2.0, 3.0), (2.0, 4.0), (1.0, 4.0)],
        tile="siret3_r001_c001.tif",
    )
    items = plants + [row, waste]
    inspector = select_waypoints(items, {"inspections", "waste"})
    farmer = select_waypoints(items, {"waste"})
    assert len(inspector) == 2
    assert len(farmer) == 1
    assert farmer[0] == inspector[1] or farmer[0] in inspector


def test_select_waypoints_uses_existing_inspection_points():
    ins = ProjectedPoly(
        kind="inspection",
        vineyard_id="V01",
        row_id="V01-R01",
        coords=[(3.1, 0.0)],
        tile="siret3_r001_c001.tif",
        extras={"id": "INS-V01-R01-01"},
    )
    waste = ProjectedPoly(
        kind="waste",
        vineyard_id="V01",
        coords=[(1.0, 3.0), (2.0, 3.0), (2.0, 4.0), (1.0, 4.0)],
        tile="siret3_r001_c001.tif",
    )
    plants = [_plant(0.0, 0.0), _plant(8.0, 0.0)]
    pts = select_waypoints(plants + [ins, waste], {"inspections", "waste"})
    assert (3.1, 0.0) in pts
    assert len([p for p in pts if p == (3.1, 0.0)]) == 1
    farmer = select_waypoints(plants + [ins, waste], {"waste"})
    assert len(farmer) == 1


def test_plants_go_to_nearest_row_line_not_centroid():
    from siret3.ids import ProjectedPoly
    from siret3.inspect import inspections_from_canopies

    def sq(x, y):
        return [(x - 0.2, y - 0.2), (x + 0.2, y - 0.2), (x + 0.2, y + 0.2), (x - 0.2, y + 0.2)]

    long_row = ProjectedPoly(kind="row", coords=[(0, 0), (100, 0)], tile="A", vineyard_id="V01", row_id="V01-R001")
    short_row = ProjectedPoly(kind="row", coords=[(95, 2.5), (100, 2.5)], tile="A", vineyard_id="V01", row_id="V01-R002")
    # plants every metre on the long row, except a 10 m gap at x=40..50; the plants near x=95..100
    # are closer to the short row's centroid than to the long row's centroid, but on the long row line.
    plants = [ProjectedPoly(kind="vineyard", coords=sq(x, 0), tile="A", vineyard_id="V01")
              for x in range(0, 101) if not 40 < x < 50]
    out = inspections_from_canopies([long_row, short_row, *plants])
    assert [o.row_id for o in out] == ["V01-R001"]
    assert abs(out[0].coords[0][0] - 44.5) < 0.6
