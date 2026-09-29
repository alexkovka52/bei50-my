import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { TopBar } from "@/components/shell/TopBar";
import { formatInt, formatKm } from "@/lib/data/format";
import { getBlock } from "@/lib/data/server";

type BlockPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: BlockPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Block ${id}` };
}

export default async function BlockPage({ params }: BlockPageProps) {
  const { id } = await params;
  const block = await getBlock(id);

  return (
    <AppShell>
      <TopBar title={`Block ${id}`} />
      {block ? (
        <EmptyState heading={`Block ${block.id}`}>
          {formatInt(block.rows)} rows cover {formatKm(block.row_km * 1000)}, with {formatInt(block.plants)} plants in the
          published flight.
        </EmptyState>
      ) : (
        <EmptyState heading={`Block ${id} is not published`}>
          This block appears after you run <code>siret3 web-bundle</code> to publish a flight.
        </EmptyState>
      )}
    </AppShell>
  );
}
