export type BarBox = { topPct: number; heightPct: number };

export function temperatureScale(days: Array<{ minC: number; maxC: number }>): { min: number; max: number } {
  if (days.length === 0) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const day of days) {
    min = Math.min(min, day.minC, day.maxC);
    max = Math.max(max, day.minC, day.maxC);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 0.5) {
    const mid = Number.isFinite(min) ? min : 0;
    return { min: mid - 1, max: mid + 1 };
  }
  return { min, max };
}

/** Vertical placement of one day's min/max inside a shared scale. Percentages of the track. */
export function temperatureBarBox(minC: number, maxC: number, scaleMin: number, scaleMax: number): BarBox {
  const low = Math.min(minC, maxC);
  const high = Math.max(minC, maxC);
  const span = scaleMax - scaleMin;
  if (!Number.isFinite(span) || span <= 0) return { topPct: 40, heightPct: 20 };
  let top = ((scaleMax - high) / span) * 100;
  let bottom = ((low - scaleMin) / span) * 100;
  top = Math.min(100, Math.max(0, top));
  bottom = Math.min(100, Math.max(0, bottom));
  let height = 100 - top - bottom;
  const minHeight = 14;
  if (height < minHeight) {
    top = Math.min(top, 100 - minHeight);
    top = Math.max(0, top - (minHeight - height) / 2);
    if (top + minHeight > 100) top = 100 - minHeight;
    height = minHeight;
  }
  return { topPct: top, heightPct: height };
}
