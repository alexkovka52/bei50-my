#!/usr/bin/env bash
# Infer the new models on the spatial val+test tiles and score them against the Marcaj ground truth.
# Usage: bash models/remote/eval_gt.sh <plants.pt> <waste.pt> <cover.pt> <rows.pt> [tag]
set -euo pipefail
ROOT="${ROOT:-/home/prodius/projects/bei50}"
cd "$ROOT"
# shellcheck disable=SC1091
source .venv/bin/activate
export PYTHONPATH="$ROOT/processing/src${PYTHONPATH:+:$PYTHONPATH}"
PLANTS="$1"; WASTE="$2"; COVER="$3"; ROWS="$4"; TAG="${5:-gt}"
OUT="data/eval_runs/$TAG"
mkdir -p "$OUT"
TILES=$(python - <<'PY'
import json
t = json.load(open("data/splits/siret3_split.json"))["tiles"]
print(" ".join(sorted(k for k, v in t.items() if v in ("val", "test"))))
PY
)
python models/infer_yolo.py --weights "$PLANTS" --tiles data/tiles --out "$OUT/plants" --conf "${PLANT_CONF:-0.15}" --only $TILES
python models/infer_yolo.py --weights "$WASTE" --tiles data/tiles --out "$OUT/waste" --conf "${WASTE_CONF:-0.2}" --only $TILES
python models/infer_semseg.py --cover "$COVER" --rows "$ROWS" --tiles data/tiles --out "$OUT/semseg" --only $TILES
for s in val test; do
  python -m siret3.cli eval --subset "$s" --plants "$OUT/plants" --waste "$OUT/waste" --semseg "$OUT/semseg" \
    --out "$OUT/eval_$s.json" > "$OUT/eval_$s.txt"
done
cat "$OUT"/eval_val.txt "$OUT"/eval_test.txt
