import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { TopBar } from "@/components/shell/TopBar";

export const metadata: Metadata = { title: "AI" };

export default function AiPage() {
  return (
    <AppShell>
      <TopBar title="How Dementra reads your vineyard" />
      <EmptyState heading="Model scores are pending">
        Training metrics appear here after <code>siret3 web-bundle</code> publishes model.json.
      </EmptyState>
    </AppShell>
  );
}
