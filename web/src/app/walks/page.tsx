import type { Metadata } from "next";
import { WalkStudio } from "@/components/walks/WalkStudio";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { TopBar } from "@/components/shell/TopBar";
import { getBlock, getSummary, getTasks } from "@/lib/data/server";
import { createRoutePath } from "@/lib/route-path";
import { loadWalkRoute } from "@/lib/walks/load-route";
import { parseBlockParam, parseWalkParam } from "@/lib/walks/tasks";

export const metadata: Metadata = {
  title: "Walks",
  description: "Inspector and farmer walks, with distance, field tasks and playback.",
};

export default async function WalksPage({
  searchParams,
}: {
  searchParams: Promise<{ walk?: string | string[]; block?: string | string[] }>;
}) {
  const params = await searchParams;
  const walk = parseWalkParam(params.walk);
  const block = parseBlockParam(params.block);
  const [summary, tasks, inspector, farmer, blockRecord] = await Promise.all([
    getSummary(),
    getTasks(),
    loadWalkRoute("inspector"),
    loadWalkRoute("farmer"),
    block ? getBlock(block) : Promise.resolve(null),
  ]);

  if (!summary || !tasks || !inspector || !farmer) {
    return (
      <AppShell>
        <TopBar title="Walks" />
        <EmptyState heading="No walks published">
          An inspector walk and a farmer walk appear here after you run <code>siret3 web-bundle</code> to publish a flight.
        </EmptyState>
      </AppShell>
    );
  }

  const inspectorPath = createRoutePath(inspector.coordinates, inspector.lengthM);
  const farmerPath = createRoutePath(farmer.coordinates, farmer.lengthM);
  return (
    <WalkStudio
      initialWalk={walk}
      initialBlock={block}
      blockBBox={blockRecord?.bbox ?? null}
      start={summary.start}
      center={summary.center}
      tasks={tasks}
      walks={{
        inspector: {
          coordinates: inspector.coordinates,
          lengthM: inspectorPath.lengthM,
          stops: summary.walks.inspector.stops,
          targetsVisited: inspector.targetsVisited,
          targetsTotal: inspector.targetsTotal,
        },
        farmer: {
          coordinates: farmer.coordinates,
          lengthM: farmerPath.lengthM,
          stops: summary.walks.farmer.stops,
          targetsVisited: farmer.targetsVisited,
          targetsTotal: farmer.targetsTotal,
        },
      }}
    />
  );
}
