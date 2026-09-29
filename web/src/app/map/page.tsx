import { readFile } from "node:fs/promises";
import path from "node:path";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MapWorkspace } from "@/components/workspace/MapWorkspace";
import { EmptyState } from "@/components/shell/EmptyState";
import { getBlocks, getRows, getSummary } from "@/lib/data/server";
import { buildMapCatalog, searchFromRecord } from "@/lib/workspace/map-state";

export const metadata: Metadata = { title: "Map" };

type MapPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function readJson(file: string): Promise<unknown> {
  try {
    const raw = await readFile(path.join(process.cwd(), "public", "data", file), "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const params = await searchParams;
  const [summary, blocks, rows, rowFeatures, gapFeatures, wasteFeatures] = await Promise.all([
    getSummary(),
    getBlocks(),
    getRows(),
    readJson("layers/rows.geojson"),
    readJson("layers/gaps.geojson"),
    readJson("layers/waste.geojson"),
  ]);

  if (!summary || !blocks || !rows) {
    return (
      <div className="flex min-h-dvh flex-col bg-forest text-dew">
        <div className="p-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-paper px-4 text-[15px] font-semibold text-forest no-underline"
          >
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} />
            Back to overview
          </Link>
        </div>
        <div className="px-8 pb-16">
          <EmptyState tone="dark" level="h1" heading="No survey data yet">
            Run <code>siret3 web-bundle</code> to publish a flight.
          </EmptyState>
        </div>
      </div>
    );
  }

  const catalog = buildMapCatalog({ summary, blocks, rows, rowFeatures, gapFeatures, wasteFeatures });

  return (
    <main className="fixed inset-0 overflow-hidden bg-forest text-dew">
      <h1 className="sr-only">{catalog.farm} map</h1>
      <MapWorkspace catalog={catalog} initialSearch={searchFromRecord(params)} />
    </main>
  );
}
