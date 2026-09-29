import type { Metadata } from "next";
import { BlocksWorkspace } from "@/components/blocks/BlocksWorkspace";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { blocksWithRowDisruption } from "@/lib/blocks/blocks";
import { getBlocks, getRows } from "@/lib/data/server";

export const metadata: Metadata = {
  title: "Blocks",
  description: "Every vineyard block ranked by row length, with gaps, waste and cover.",
};

type BlocksPageProps = {
  searchParams: Promise<{ selected?: string | string[] }>;
};

function selectedParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function BlocksPage({ searchParams }: BlocksPageProps) {
  const [blocks, rows, params] = await Promise.all([getBlocks(), getRows(), searchParams]);
  const ranked = blocks ? blocksWithRowDisruption(blocks, rows ?? []) : null;

  return (
    <AppShell>
      {ranked && ranked.length > 0 ? (
        <BlocksWorkspace blocks={ranked} initialSelected={selectedParam(params.selected)} />
      ) : (
        <>
          <h1 className="m-0 font-display text-[40px] font-bold leading-none tracking-[-1px] text-forest">Blocks</h1>
          <EmptyState heading="No blocks published">
            Block ranks show up after <code>siret3 web-bundle</code> publishes the vineyard.
          </EmptyState>
        </>
      )}
    </AppShell>
  );
}
