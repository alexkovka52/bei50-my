import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { TopBar } from "@/components/shell/TopBar";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <AppShell>
      <TopBar title="Reports" />
      <EmptyState heading="No report published">
        Measurements, downloads and a printable summary appear after <code>siret3 web-bundle</code> publishes a flight.
      </EmptyState>
    </AppShell>
  );
}
