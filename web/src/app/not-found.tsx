import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <AppShell>
      <TopBar title="Not found" />
      <section className="max-w-xl">
        <h2 className="m-0 font-display text-[28px] font-bold tracking-[-0.5px]">This page is not in the vineyard</h2>
        <p className="mt-3 text-base leading-relaxed text-ink-muted">
          The address does not match an overview, map, walk, block, report or model page.
        </p>
        <Button href="/" className="mt-6">
          Back to overview
        </Button>
      </section>
    </AppShell>
  );
}
