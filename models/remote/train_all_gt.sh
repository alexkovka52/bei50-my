#!/usr/bin/env bash
# Train on the Marcaj ground truth (datasets from models/prepare_siret3_gt.py).
# Usage: bash models/remote/train_all_gt.sh plants26|plants11|waste|semseg|rows
# Jobs can share the H100 (80 GB); each refuses to start if the same job is already running.
set -euo pipefail
ROOT="${ROOT:-/home/prodius/projects/bei50}"
cd "$ROOT"
# shellcheck disable=SC1091
source .venv/bin/activate
job="${1:?plants26|plants11|waste|semseg|rows}"
mkdir -p logs
if pgrep -f "name ${job}-gt" >/dev/null || pgrep -f "out models/runs/${job}-gt" >/dev/null; then
  echo "${job} already running; not starting"
  exit 2
fi

plants() {  # $1 = yolo11 | yolo26
  python models/train_yolo.py --task segment --arch "$1" --profile h100 \
    --data datasets/siret3-gt-plants/plants.yaml \
    --name "${job}-gt" --copy-best "models/weights/plants_gt_$1m.pt" \
    --epochs 150 --patience 30 --imgsz 1024 --batch 16 \
    --degrees 90 --flipud 0.5 --scale 0.3 --translate 0.1 --copy-paste 0.3 \
    --max-det 1500 --close-mosaic 15
}

case "$job" in
  plants26) plants yolo26 ;;
  plants11) plants yolo11 ;;
  waste)
    python models/train_yolo.py --task detect --arch yolo12 --profile h100 \
      --weights models/weights/waste.pt \
      --data datasets/siret3-gt-waste/waste.yaml \
      --name "${job}-gt" --copy-best models/weights/waste_gt_yolo12m.pt \
      --epochs 100 --patience 40 --imgsz 1024 --batch 16 \
      --degrees 90 --flipud 0.5 --scale 0.3 --mixup 0.1 --close-mosaic 10
    ;;
  semseg)
    python models/train_semseg.py --data datasets/siret3-gt-semseg/semseg.json \
      --arch segformer --encoder mit_b2 --epochs 40 --iters 600 --batch 4 --lr 1.5e-4 \
      --out "models/runs/${job}-gt"
    ;;
  rows)
    python models/train_semseg.py --data datasets/siret3-gt-semseg/semseg.json --target rows \
      --arch unet --encoder resnet34 --epochs 30 --iters 600 --batch 4 --lr 3e-4 \
      --out "models/runs/${job}-gt"
    ;;
  *) echo "unknown job $job"; exit 1 ;;
esac
echo "${job} done"
