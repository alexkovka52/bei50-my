"use client";

import { AppShell } from "@/components/shell/AppShell";
import { PageProblem } from "@/components/shell/PageProblem";

export default function OverviewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppShell>
      <PageProblem title="Overview" message="The overview could not be loaded." onRetry={reset} />
    </AppShell>
  );
}
