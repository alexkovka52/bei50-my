import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { TopBar } from "@/components/shell/TopBar";

export const metadata: Metadata = { title: "Blocks" };

export default function BlocksPage() {
  return (
    <AppShell>
      <TopBar title="Blocks" />
      <EmptyState heading="No blocks published">
        Block ranks show up after <code>siret3 web-bundle</code> publishes the vineyard.
      </EmptyState>
    </AppShell>
  );
}
