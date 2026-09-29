"use client";

import { AppShell } from "@/components/shell/AppShell";
import { PageProblem } from "@/components/shell/PageProblem";

export default function ReportsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppShell>
      <PageProblem title="Reports" message="The report could not be loaded." onRetry={reset} />
    </AppShell>
  );
}
