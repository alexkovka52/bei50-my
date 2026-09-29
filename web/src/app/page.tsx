import type { Metadata } from "next";
import { CoverCard } from "@/components/overview/CoverCard";
import { blockWithMostGaps, disruptedRowCount, numberStats, statusDetail, statusHeadline } from "@/components/overview/model";
import { NextTasks } from "@/components/overview/NextTasks";
import { NumbersStrip } from "@/components/overview/NumbersStrip";
import { PreviewCard } from "@/components/overview/PreviewCard";
import { StatusCard } from "@/components/overview/StatusCard";
import { WeatherCard } from "@/components/overview/WeatherCard";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { TopBar } from "@/components/shell/TopBar";
import { getBlocks, getRows, getSummary, getTasks } from "@/lib/data/server";
import { loadWalkRoute } from "@/lib/walks/load-route";
import { loadForecast } from "@/lib/weather/load";

export const metadata: Metadata = {
  title: { absolute: "Overview | Dementra" },
  description: "Planting gaps, waste and the inspector walk for the latest Sireț3 flight.",
};

/** A successful forecast stays with the page for 30 minutes. A failed forecast calls noStore() and is not kept. */
export const revalidate = 1800;

export default async function OverviewPage() {
  const summary = await getSummary();
  if (!summary) {
    return (
      <AppShell>
        <TopBar title="Overview" />
        <EmptyState heading="No survey data yet">
          Run <code>siret3 web-bundle</code> to publish a flight.
        </EmptyState>
      </AppShell>
    );
  }

  const [blocks, tasks, rows, weather, inspector] = await Promise.all([
    getBlocks(),
    getTasks(),
    getRows(),
    loadForecast(summary.center),
    loadWalkRoute("inspector"),
  ]);
  const block = blocks ? blockWithMostGaps(blocks) : null;
  const disrupted = block && rows ? disruptedRowCount(rows, block.id) : null;

  return (
    <AppShell>
      <TopBar title="Overview" />
      <div className="grid min-h-0 flex-1 content-start grid-cols-1 items-start gap-[22px] min-[1201px]:grid-cols-[minmax(0,1fr)_520px] min-[1201px]:content-stretch min-[1201px]:items-stretch">
        <div className="flex min-w-0 flex-col gap-[22px]">
          <StatusCard
            headline={statusHeadline(summary)}
            detail={statusDetail(summary, inspector ? { visited: inspector.targetsVisited, total: inspector.targetsTotal } : null)}
          />
          <NumbersStrip stats={numberStats(summary, rows)} />
          <div className="grid grid-cols-1 items-stretch gap-[22px] min-[701px]:grid-cols-2">
            <WeatherCard forecast={weather} />
            <CoverCard cover={summary.cover} />
          </div>
          <NextTasks tasks={tasks ?? []} />
        </div>
        <PreviewCard summary={summary} block={block} disruptedRows={disrupted} />
      </div>
    </AppShell>
  );
}
