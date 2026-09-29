#!/usr/bin/env python3
"""Train inter-row area + cover semantic segmentation on Marcaj ground truth.

Classes (datasets/siret3-gt-semseg/semseg.json): 0 background, 1 canopy, 2 bare_soil,
3 vegetation, 4 mixed; 255 = ignore (inter-rows without a cover value).
Input: full 2048 GeoTIFF tiles + full masks, random 1024 crops on the fly at native 0.025 m/px.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

IGNORE = 255
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32) * 255
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32) * 255


def read_rgb(tile: Path) -> np.ndarray:
    import rasterio

    with rasterio.open(tile) as src:
        return np.ascontiguousarray(np.transpose(src.read([1, 2, 3]), (1, 2, 0)))


def read_mask(path: Path) -> np.ndarray:
    from PIL import Image

    return np.asarray(Image.open(path))


def to_tensor(rgb: np.ndarray) -> torch.Tensor:
    x = (rgb.astype(np.float32) - MEAN) / STD
    return torch.from_numpy(x.transpose(2, 0, 1).copy())


class TileCrops(Dataset):
    """Random crops; half of them centred on a pixel of a rare class present in the tile."""

    def __init__(self, tiles, masks, *, crop: int, length: int, rare: tuple[int, ...], seed: int = 0):
        self.tiles, self.masks, self.crop, self.length, self.rare = tiles, masks, crop, length, rare
        self.rare_px = []
        for m in masks:
            ys, xs = np.nonzero(np.isin(m[::8, ::8], rare))
            self.rare_px.append(np.stack([ys * 8, xs * 8], 1) if len(ys) else None)
        self.rng = random.Random(seed)

    def __len__(self) -> int:
        return self.length

    def __getitem__(self, _i: int):
        rng = self.rng
        k = rng.randrange(len(self.tiles))
        rgb, mask = self.tiles[k], self.masks[k]
        h, w = mask.shape
        c = self.crop
        if self.rare_px[k] is not None and rng.random() < 0.5:
            cy, cx = self.rare_px[k][rng.randrange(len(self.rare_px[k]))]
            y0 = int(np.clip(cy - c // 2 + rng.randint(-c // 4, c // 4), 0, h - c))
            x0 = int(np.clip(cx - c // 2 + rng.randint(-c // 4, c // 4), 0, w - c))
        else:
            y0, x0 = rng.randint(0, h - c), rng.randint(0, w - c)
        img = rgb[y0 : y0 + c, x0 : x0 + c]
        lab = mask[y0 : y0 + c, x0 : x0 + c]
        r = rng.randrange(4)
        img, lab = np.rot90(img, r), np.rot90(lab, r)
        if rng.random() < 0.5:
            img, lab = img[:, ::-1], lab[:, ::-1]
        img = img.astype(np.float32)
        img = img * rng.uniform(0.8, 1.2) + rng.uniform(-20, 20)
        img = np.clip(img, 0, 255)
        return to_tensor(img), torch.from_numpy(np.ascontiguousarray(lab).astype(np.int64))


def _seed_worker(i: int) -> None:
    info = torch.utils.data.get_worker_info()
    info.dataset.rng.seed(info.seed)


def build_model(arch: str, encoder: str, n_classes: int):
    import segmentation_models_pytorch as smp

    cls = {"unet": smp.Unet, "unetpp": smp.UnetPlusPlus, "segformer": smp.Segformer, "upernet": smp.UPerNet}[arch]
    return cls(encoder_name=encoder, encoder_weights="imagenet", in_channels=3, classes=n_classes)


@torch.no_grad()
def predict_tile(model, rgb: np.ndarray, *, crop: int = 1024, stride: int = 768, n_classes: int = 5) -> np.ndarray:
    """Sliding-window softmax average over a full tile. Returns (C, H, W) float32 probabilities."""
    h, w = rgb.shape[:2]
    ys = sorted({*range(0, max(h - crop, 0) + 1, stride), max(h - crop, 0)})
    xs = sorted({*range(0, max(w - crop, 0) + 1, stride), max(w - crop, 0)})
    acc = torch.zeros((n_classes, h, w), device="cuda")
    cnt = torch.zeros((1, h, w), device="cuda")
    batch, where = [], []
    for y0 in ys:
        for x0 in xs:
            batch.append(to_tensor(rgb[y0 : y0 + crop, x0 : x0 + crop]))
            where.append((y0, x0))
    x = torch.stack(batch).cuda()
    with torch.autocast("cuda", dtype=torch.bfloat16):
        logits = model(x).float()
        logits = (logits + model(x.flip(-1)).float().flip(-1)) / 2
    prob = logits.softmax(1)
    for p, (y0, x0) in zip(prob, where):
        acc[:, y0 : y0 + crop, x0 : x0 + crop] += p
        cnt[:, y0 : y0 + crop, x0 : x0 + crop] += 1
    return (acc / cnt).cpu().numpy()


def confusion(pred: np.ndarray, gt: np.ndarray, n: int) -> np.ndarray:
    keep = gt != IGNORE
    return np.bincount(n * gt[keep].astype(np.int64) + pred[keep], minlength=n * n).reshape(n, n)


def iou_report(conf: np.ndarray, names: list[str]) -> dict:
    tp = np.diag(conf).astype(float)
    iou = tp / np.maximum(conf.sum(0) + conf.sum(1) - tp, 1)
    return {"iou": {n: round(float(v), 4) for n, v in zip(names, iou)}, "miou_fg": round(float(iou[1:].mean()), 4),
            "pixel_acc": round(float(tp.sum() / max(conf.sum(), 1)), 4)}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="datasets/siret3-gt-semseg/semseg.json")
    p.add_argument("--target", default="cover", choices=["cover", "rows"],
                   help="cover: bg/canopy/bare/veg/mixed from masks/; rows: row centre lines from rowmasks/")
    p.add_argument("--arch", default="segformer", choices=["unet", "unetpp", "segformer", "upernet"])
    p.add_argument("--encoder", default="mit_b2")
    p.add_argument("--crop", type=int, default=1024)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--epochs", type=int, default=40)
    p.add_argument("--iters", type=int, default=300, help="iterations per epoch")
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--workers", type=int, default=12)
    p.add_argument("--out", default="models/runs/semseg-gt")
    args = p.parse_args()

    meta = json.loads(Path(args.data).read_text())
    root = Path(args.data).parent
    tiles_dir = Path(meta["tiles_dir"])
    if args.target == "rows":
        names, mask_dir, rare = ["background", "row"], "rowmasks", (1,)
    else:
        names, mask_dir, rare = meta["classes"], "masks", (3, 4)
    n = len(names)

    def load(subset):
        tl = [read_rgb(tiles_dir / t) for t in meta[subset]]
        ms = [read_mask(root / mask_dir / f"{Path(t).stem}.png") for t in meta[subset]]
        return tl, ms

    t0 = time.time()
    train_t, train_m = load("train")
    val_t, val_m = load("val")
    print(f"loaded {len(train_t)} train / {len(val_t)} val tiles in {time.time() - t0:.0f}s", flush=True)

    freq = np.zeros(n)
    for m in train_m:
        freq += np.bincount(m[m != IGNORE].ravel(), minlength=n)[:n]
    weights = 1.0 / np.sqrt(np.maximum(freq / freq.sum(), 1e-6))
    weights = weights / weights.mean()
    print("class px freq", dict(zip(names, (freq / freq.sum()).round(4))), "ce weights", weights.round(2), flush=True)

    ds = TileCrops(train_t, train_m, crop=args.crop, length=args.iters * args.batch, rare=rare)
    dl = DataLoader(ds, batch_size=args.batch, num_workers=args.workers, shuffle=True, drop_last=True,
                    persistent_workers=True, worker_init_fn=_seed_worker)

    import segmentation_models_pytorch as smp

    model = build_model(args.arch, args.encoder, n).cuda()
    dice = smp.losses.DiceLoss("multiclass", ignore_index=IGNORE)
    ce_w = torch.tensor(weights, dtype=torch.float32).cuda()
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-2)
    total = args.epochs * args.iters
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: min(1.0, (s + 1) / 300) * 0.5 * (1 + math.cos(math.pi * min(s, total) / total)))

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    best, history = -1.0, []
    for epoch in range(args.epochs):
        model.train()
        t0, losses = time.time(), []
        for x, y in dl:
            x, y = x.cuda(non_blocking=True), y.cuda(non_blocking=True)
            with torch.autocast("cuda", dtype=torch.bfloat16):
                logits = model(x)
            logits = logits.float()
            loss = F.cross_entropy(logits, y, weight=ce_w, ignore_index=IGNORE) + dice(logits, y)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            losses.append(loss.item())
        model.eval()
        conf = np.zeros((n, n), dtype=np.int64)
        for rgb, m in zip(val_t, val_m):
            pred = predict_tile(model, rgb, crop=args.crop, n_classes=n).argmax(0)
            conf += confusion(pred, m, n)
        rep = iou_report(conf, names)
        rep.update(epoch=epoch, loss=round(float(np.mean(losses)), 4), secs=round(time.time() - t0))
        history.append(rep)
        print(json.dumps(rep), flush=True)
        ckpt = {"arch": args.arch, "encoder": args.encoder, "classes": names, "target": args.target, "state_dict": model.state_dict(),
                "epoch": epoch, "val": rep}
        torch.save(ckpt, out / "last.pt")
        if rep["miou_fg"] > best:
            best = rep["miou_fg"]
            torch.save(ckpt, out / "best.pt")
            (out / "confusion_best.json").write_text(json.dumps({"names": names, "confusion": conf.tolist()}))
        (out / "history.json").write_text(json.dumps(history, indent=1))
    print(f"best val mIoU(fg) {best}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
