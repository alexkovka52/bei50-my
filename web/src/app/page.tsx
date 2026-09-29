import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { TopBar } from "@/components/shell/TopBar";

export default function OverviewPage() {
  return (
    <AppShell>
      <TopBar title="Overview" />
      <EmptyState heading="No survey data yet">
        Run <code>siret3 web-bundle</code> to publish a flight.
      </EmptyState>
    </AppShell>
  );
}
