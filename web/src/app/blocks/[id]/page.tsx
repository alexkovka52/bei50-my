import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlockFacts } from "@/components/blocks/BlockFacts";
import { BlockMap } from "@/components/blocks/BlockMap";
import { BlockRows } from "@/components/blocks/BlockRows";
import { AppShell } from "@/components/shell/AppShell";
import { findBlock, rowsForBlock } from "@/lib/blocks/blocks";
import { getBlocks, getRows } from "@/lib/data/server";

type BlockPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  const blocks = await getBlocks();
  return (blocks ?? []).map((block) => ({ id: block.id }));
}

export async function generateMetadata({ params }: BlockPageProps): Promise<Metadata> {
  const { id } = await params;
  const blocks = await getBlocks();
  const block = findBlock(blocks ?? [], id);
  return { title: block ? `Block ${block.id}` : "Block" };
}

export default async function BlockPage({ params }: BlockPageProps) {
  const { id } = await params;
  const [blocks, rows] = await Promise.all([getBlocks(), getRows()]);
  const block = findBlock(blocks ?? [], id);
  if (!block) notFound();

  return (
    <AppShell>
      <nav aria-label="Breadcrumb">
        <ol className="m-0 flex list-none items-center gap-2 p-0 text-[15px]">
          <li>
            <Link href="/blocks" className="inline-flex min-h-11 items-center font-semibold text-moss no-underline">
              Blocks
            </Link>
          </li>
          <li aria-hidden="true" className="text-ink-muted">
            /
          </li>
          <li aria-current="page" className="text-forest">
            Block {block.id}
          </li>
        </ol>
      </nav>
      <div className="grid min-w-0 items-start gap-[22px] min-[1201px]:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 overflow-hidden rounded-card">
          <BlockMap block={block} className="h-[240px] w-full min-[700px]:h-[420px]" />
        </div>
        <section aria-label={`Block ${block.id}`} className="rounded-card bg-paper px-[22px] py-5">
          <BlockFacts block={block} level="h1" />
        </section>
        <div className="min-w-0 min-[1201px]:col-span-2">
          <BlockRows rows={rows ? rowsForBlock(rows, block.id) : null} />
        </div>
      </div>
    </AppShell>
  );
}
