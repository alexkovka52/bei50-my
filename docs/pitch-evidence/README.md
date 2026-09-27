# Pitch evidence — send this folder

DM `@x096a` before **14:00**. No slides in here. GitHub already sent.

## Send first

`scorecard.png` (also `scorecard.csv` if they want the raw table).

## Jury 10% numbers (EPSG:32635, 311-tile stitch)

| Slice | Field | Value |
| --- | --- | --- |
| 2% | Blocks | **1,253** |
| 2% | Rows | **2,234** |
| 2% | Canopy union | **12,238.874 m² / 1.223887 ha** |
| 2% | Inter-row union | **70,927.676 m² / 7.092768 ha** |
| 2% | Total row length | **36,943.064 m** |

Jury computes the 10% from **Marcaj**, same way for every team. These are the CSV / web numbers.

## Walks (not the 10% slide)

- Inspector `route.geojson`: **7,991.683 m**, closed at official start **629504.70, 5220250.75**
- Farmer `route_farmer.geojson`: **4,293.173 m**, same start

Do **not** move the start to the pretest point.

## Pre-test point

- UTM 35N: **629663.8, 5220195.3**
- WGS84: **47.1225039 N, 28.7094577 E**
- Inside study area (pytest)
- Nearest inspector vertex **17.15 m**, nearest farmer **49.57 m** (not claimed as a 2 m visit)

## Tests

`pytest.txt`: **78 passed** in `processing/` (includes `tests/test_pretest_point.py`). No tiles were missing.

## Files

| File | What |
| --- | --- |
| `scorecard.png` | Table for `@x096a` |
| `scorecard.csv` | Same numbers |
| `scorecard.html` | Printable table |
| `dementra-survey.png` | Live UI metrics |
| `pretest-pin.png` | Plan form at pretest lon/lat, Inspector selected |
| `inspector-walk.png` | Inspector 7.99 km |
| `farmer-walk.png` | Farmer 4.29 km |
| `pytest.txt` | Full pytest log |

Live UI: https://dementra.md
