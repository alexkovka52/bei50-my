import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { TopBar } from "@/components/shell/TopBar";

export const metadata: Metadata = { title: "Walks" };

export default function WalksPage() {
  return (
    <AppShell>
      <TopBar title="Walks" />
      <EmptyState heading="No walks published">
        An inspector walk and a farmer walk appear here after you run <code>siret3 web-bundle</code> to publish a flight.
      </EmptyState>
    </AppShell>
  );
}
