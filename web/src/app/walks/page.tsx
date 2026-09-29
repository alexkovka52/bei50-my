import type { Metadata } from "next";
import { WalkStudio } from "@/components/walks/WalkStudio";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { TopBar } from "@/components/shell/TopBar";
import { getBlock, getSummary, getTasks } from "@/lib/data/server";
import { createRoutePath } from "@/lib/route-path";
import { loadWalkRoute } from "@/lib/walks/load-route";
import { withRouteDistance } from "@/lib/walks/position";
import { parseBlockParam, parseWalkParam } from "@/lib/walks/tasks";

export const metadata: Metadata = { title: "Walks" };

export default async function WalksPage({
  searchParams,
}: {
  searchParams: Promise<{ walk?: string | string[]; block?: string | string[] }>;
}) {
  const params = await searchParams;
  const walk = parseWalkParam(params.walk);
  const block = parseBlockParam(params.block);
  const [summary, tasks, route, blockRecord] = await Promise.all([
    getSummary(),
    getTasks(),
    loadWalkRoute(walk),
    block ? getBlock(block) : Promise.resolve(null),
  ]);

  if (!summary || !tasks || !route) {
    return (
      <AppShell>
        <TopBar title="Walks" />
        <EmptyState heading="No walks published">
          An inspector walk and a farmer walk appear here after you run <code>siret3 web-bundle</code> to publish a flight.
        </EmptyState>
      </AppShell>
    );
  }

  const path = createRoutePath(route.coordinates, route.lengthM);
  return (
    <WalkStudio
      key={`${walk}:${block ?? ""}`}
      walk={walk}
      block={block}
      blockBBox={blockRecord?.bbox ?? null}
      start={summary.start}
      center={summary.center}
      stops={summary.walks[walk].stops}
      tasks={withRouteDistance(path, tasks)}
      coordinates={route.coordinates}
      lengthM={path.lengthM}
    />
  );
}
