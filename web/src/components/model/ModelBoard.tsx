import type { ModelFile, Summary } from "@/lib/data/types";
import { formatInt } from "@/lib/data/format";
import { cn } from "@/lib/utils";
import {
  HELD_OUT_LINE,
  MODEL_LEDE,
  MODEL_TITLE,
  TRAINING_LINE,
  datasetStats,
  flyAndTileDetail,
  formatMetricValue,
  heldOutLabel,
  pipelineSteps,
  splitParts,
} from "@/components/model/model";

const SPLIT_COLOR = {
  train: "var(--color-sage)",
  val: "var(--color-lichen)",
  test: "var(--color-budbreak)",
} as const;

export function ModelBoard({ model, summary }: { model: ModelFile; summary: Summary | null }) {
  const steps = pipelineSteps(
    flyAndTileDetail({
      tiles: summary?.tiles ?? model.dataset.tiles,
      gsdM: summary?.gsd_m ?? null,
      areaHa: summary?.area_ha ?? null,
    }),
  );
  const stats = datasetStats(model.dataset);
  const parts = splitParts(model.dataset.split);
  const splitTotal = parts.reduce((sum, part) => sum + part.value, 0);
  const splitText = parts.map((part) => `${part.label} ${formatInt(part.value)}`).join(", ");

  return (
    <div className="flex min-w-0 flex-col gap-[22px]">
      <header>
        <h1 className="m-0 max-w-full font-display text-[32px] font-bold leading-tight tracking-[-1px] text-balance text-forest min-[720px]:text-[40px] min-[720px]:leading-none">
          {MODEL_TITLE}
        </h1>
        <p className="mt-1.5 mb-0 max-w-3xl text-base text-pretty text-ink-muted">{MODEL_LEDE}</p>
      </header>

      <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-3 min-[1300px]:grid-cols-6">
        {steps.map((step, index) => {
          const lead = index === 0;
          return (
            <li
              key={step.title}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-sheet p-[18px]",
                lead ? "bg-forest text-dew" : "bg-paper text-forest",
              )}
            >
              <span
                aria-hidden="true"
                className={cn("font-display text-[28px] leading-none font-bold", lead ? "text-budbreak" : "text-moss")}
              >
                {index + 1}
              </span>
              <div className="text-[15px] font-semibold">{step.title}</div>
              <p className={cn("m-0 text-[13px] leading-snug", lead ? "text-mist" : "text-ink-muted")}>{step.detail}</p>
            </li>
          );
        })}
      </ol>

      <div className="grid min-w-0 items-start gap-[22px] min-[1100px]:grid-cols-[minmax(0,1fr)_440px]">
        <section className="min-w-0 rounded-card bg-paper px-[26px] py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-lg font-semibold">Scores on fields the models never saw</h2>
            <p className="m-0 text-[13px] text-ink-muted">{heldOutLabel(model.dataset.split.test)}</p>
          </div>
          <div className="mt-3 min-w-0 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[15px]">
              <caption className="sr-only">Model scores before training on this vineyard and now</caption>
              <thead>
                <tr className="text-left text-[13px] text-ink-muted">
                  <th scope="col" className="py-2.5 pr-3 font-medium">
                    What we measure
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Before
                  </th>
                  <th scope="col" className="py-2.5 pl-3 text-right font-medium">
                    Now
                  </th>
                </tr>
              </thead>
              <tbody>
                {model.metrics.length === 0 ? (
                  <tr className="border-t border-line">
                    <td colSpan={3} className="py-3.5 text-ink-muted">
                      Not measured
                    </td>
                  </tr>
                ) : (
                  model.metrics.map((metric) => (
                    <tr key={metric.key} className="border-t border-line">
                      <th scope="row" className="py-3.5 pr-3 text-left font-normal">
                        {metric.label}
                      </th>
                      <td className="px-3 py-3.5 text-right text-ink-muted tabular-nums">
                        {formatMetricValue(metric.before, "before")}
                      </td>
                      <td className="py-3.5 pl-3 text-right font-semibold tabular-nums">
                        {formatMetricValue(metric.now, "now")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-4 mb-0 max-w-[620px] text-sm leading-relaxed text-ink-muted">{HELD_OUT_LINE}</p>
        </section>

        <section className="flex flex-col gap-4 rounded-card bg-forest px-[26px] py-6 text-dew">
          <h2 className="m-0 text-lg font-semibold">Trained on your own labels</h2>
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="font-display text-[34px] leading-none font-bold tracking-[-0.5px] tabular-nums">{stat.value}</div>
                <div className="mt-1 text-[13px] text-mist">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-mist">How the {formatInt(model.dataset.tiles)} tiles are used</div>
            {splitTotal > 0 ? (
              <div className="flex h-3 overflow-hidden rounded-pill" role="img" aria-label={`Tile split: ${splitText}`}>
                {parts.map((part) => (
                  <div key={part.key} style={{ width: `${(part.value / splitTotal) * 100}%`, background: SPLIT_COLOR[part.key] }} />
                ))}
              </div>
            ) : (
              <p className="m-0 text-[13px] text-mist">Not measured</p>
            )}
            <div className="flex flex-wrap gap-x-4 text-[13px]">
              {parts.map((part) => (
                <span key={part.key}>
                  {part.label} {formatInt(part.value)}
                </span>
              ))}
            </div>
          </div>
          <p className="m-0 text-[13px] leading-relaxed text-mist">{TRAINING_LINE}</p>
        </section>
      </div>
    </div>
  );
}
